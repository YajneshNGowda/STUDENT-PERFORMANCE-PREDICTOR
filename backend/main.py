"""
FastAPI Backend — Student Risk Prediction System
Endpoints: predict, batch upload, student details, alerts, metrics
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import pandas as pd
import numpy as np
import joblib
import json
import os
import io
import logging
from datetime import datetime

# ── Setup ─────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, '../models')

app = FastAPI(
    title="Student Risk Prediction API",
    description="Early Warning System for at-risk students in engineering colleges",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Artifacts ────────────────────────────────────────────────────────────
pipeline = None
explainer = None
metrics = None
le_dept = None

def load_artifacts():
    global pipeline, explainer, metrics, le_dept
    try:
        pipeline = joblib.load(os.path.join(MODEL_DIR, 'risk_pipeline.pkl'))
        explainer = joblib.load(os.path.join(MODEL_DIR, 'shap_explainer.pkl'))
        le_dept = joblib.load(os.path.join(MODEL_DIR, 'le_dept.pkl'))
        with open(os.path.join(MODEL_DIR, 'metrics.json')) as f:
            metrics = json.load(f)
        logger.info("✅ All model artifacts loaded.")
    except Exception as e:
        logger.error(f"❌ Failed to load artifacts: {e}")
        raise

load_artifacts()

FEATURE_COLS = metrics['feature_names']

# ── Schemas ───────────────────────────────────────────────────────────────────
class StudentInput(BaseModel):
    student_id: str
    department: str
    semester: int = Field(ge=1, le=8)
    attendance_pct: float = Field(ge=0, le=100)
    internal_marks: float = Field(ge=0, le=100)
    assignment_submission_rate: float = Field(ge=0, le=100)
    prev_semester_cgpa: float = Field(ge=0, le=10)
    lab_attendance_pct: float = Field(ge=0, le=100)
    quiz_avg_score: float = Field(ge=0, le=100)
    library_visits_per_month: int = Field(ge=0, le=30)
    extracurricular_participation: int = Field(ge=0, le=1)
    active_backlogs: int = Field(ge=0, le=20)

class BatchPredictResponse(BaseModel):
    total: int
    at_risk_count: int
    at_risk_pct: float
    students: List[dict]


# ── Helpers ───────────────────────────────────────────────────────────────────
def encode_and_predict(df: pd.DataFrame):
    """Encode, predict probabilities, add SHAP explanations."""
    dept_enc = le_dept.transform(df['department'].astype(str))
    df = df.copy()
    df['dept_enc'] = dept_enc

    X = df[FEATURE_COLS]
    proba = pipeline.predict_proba(X)[:, 1]
    threshold = metrics['best_threshold']
    preds = (proba >= threshold).astype(int)

    # SHAP explanations
    model = pipeline.named_steps['model']
    shap_vals = explainer.shap_values(X)

    results = []
    for i, (_, row) in enumerate(df.iterrows()):
        top_factors = sorted(
            zip(FEATURE_COLS, shap_vals[i]),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:5]

        risk_prob = float(proba[i])
        if risk_prob < 0.3:
            risk_level = "Low"
        elif risk_prob < 0.55:
            risk_level = "Medium"
        elif risk_prob < 0.75:
            risk_level = "High"
        else:
            risk_level = "Critical"

        results.append({
            'student_id': str(row.get('student_id', f'STU_{i}')),
            'department': str(row.get('department', 'N/A')),
            'semester': int(row.get('semester', 0)),
            'risk_probability': round(risk_prob, 4),
            'predicted_at_risk': int(preds[i]),
            'risk_level': risk_level,
            'top_risk_factors': [
                {'feature': f, 'shap_value': round(float(s), 4), 'impact': 'increases' if s > 0 else 'decreases'}
                for f, s in top_factors
            ],
            'key_metrics': {
                'attendance_pct': float(row.get('attendance_pct', 0)),
                'internal_marks': float(row.get('internal_marks', 0)),
                'assignment_submission_rate': float(row.get('assignment_submission_rate', 0)),
                'prev_semester_cgpa': float(row.get('prev_semester_cgpa', 0)),
            }
        })
    return results


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Student Risk Prediction API", "status": "online", "version": "1.0.0"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/predict/student")
def predict_student(student: StudentInput, background_tasks: BackgroundTasks):
    """Predict risk for a single student with SHAP explanation."""
    try:
        df = pd.DataFrame([student.dict()])
        results = encode_and_predict(df)
        result = results[0]

        # Auto-trigger alert for high/critical
        if result['risk_level'] in ['High', 'Critical']:
            background_tasks.add_task(trigger_alert, result)

        return {"success": True, "prediction": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch")
async def predict_batch(file: UploadFile = File(...)):
    """Batch prediction from uploaded CSV file."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))

        required_cols = ['student_id', 'department', 'semester', 'attendance_pct',
                         'internal_marks', 'assignment_submission_rate',
                         'prev_semester_cgpa', 'lab_attendance_pct',
                         'quiz_avg_score', 'library_visits_per_month',
                         'extracurricular_participation', 'active_backlogs']

        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

        results = encode_and_predict(df)
        at_risk = [r for r in results if r['predicted_at_risk'] == 1]

        return {
            "success": True,
            "summary": {
                "total_students": len(results),
                "at_risk_count": len(at_risk),
                "at_risk_pct": round(len(at_risk) / len(results) * 100, 2),
                "critical": sum(1 for r in results if r['risk_level'] == 'Critical'),
                "high": sum(1 for r in results if r['risk_level'] == 'High'),
                "medium": sum(1 for r in results if r['risk_level'] == 'Medium'),
                "low": sum(1 for r in results if r['risk_level'] == 'Low'),
            },
            "students": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model/metrics")
def get_metrics():
    """Return model performance metrics."""
    return {
        "success": True,
        "metrics": {
            "f1_score_cv": metrics.get('f1_cv'),
            "auc_roc_cv": metrics.get('auc_roc_cv'),
            "avg_precision_cv": metrics.get('avg_precision_cv'),
            "threshold": metrics.get('best_threshold'),
            "training_samples": metrics.get('n_samples'),
            "at_risk_in_training": metrics.get('n_at_risk'),
        }
    }


@app.get("/model/feature-importance")
def get_feature_importance():
    """Return global SHAP feature importances."""
    try:
        path = os.path.join(MODEL_DIR, 'feature_importance.csv')
        df = pd.read_csv(path)
        return {"success": True, "features": df.to_dict(orient='records')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/overview")
def dashboard_overview():
    """Summary stats for dashboard from latest predictions."""
    try:
        path = os.path.join(MODEL_DIR, 'predictions.csv')
        df = pd.read_csv(path)

        risk_by_dept = df.groupby('department').agg(
            total=('student_id', 'count'),
            at_risk=('predicted_at_risk', 'sum')
        ).reset_index()
        risk_by_dept['risk_pct'] = (risk_by_dept['at_risk'] / risk_by_dept['total'] * 100).round(2)

        return {
            "success": True,
            "total_students": len(df),
            "at_risk_count": int(df['predicted_at_risk'].sum()),
            "at_risk_pct": round(df['predicted_at_risk'].mean() * 100, 2),
            "risk_levels": df['risk_level'].value_counts().to_dict(),
            "by_department": risk_by_dept.to_dict(orient='records'),
            "avg_risk_probability": round(df['risk_probability'].mean(), 4)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/students/at-risk")
def get_at_risk_students(limit: int = 50, risk_level: Optional[str] = None):
    """Get list of at-risk students, optionally filtered by risk level."""
    try:
        pred_df = pd.read_csv(os.path.join(MODEL_DIR, 'predictions.csv'))
        shap_df = pd.read_csv(os.path.join(MODEL_DIR, 'shap_per_student.csv'))

        at_risk_df = pred_df[pred_df['predicted_at_risk'] == 1].copy()
        if risk_level:
            at_risk_df = at_risk_df[at_risk_df['risk_level'] == risk_level]

        at_risk_df = at_risk_df.sort_values('risk_probability', ascending=False).head(limit)

        return {
            "success": True,
            "count": len(at_risk_df),
            "students": at_risk_df.to_dict(orient='records')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Alert System ──────────────────────────────────────────────────────────────
alert_log = []

def trigger_alert(student_result: dict):
    """
    Automated alert system.
    In production: integrate with SendGrid (email), Twilio (SMS), or Slack webhook.
    Here: logs to in-memory store + prints structured alert.
    """
    alert = {
        "timestamp": datetime.now().isoformat(),
        "student_id": student_result['student_id'],
        "risk_level": student_result['risk_level'],
        "risk_probability": student_result['risk_probability'],
        "department": student_result['department'],
        "semester": student_result['semester'],
        "top_factors": student_result['top_risk_factors'][:3],
        "alert_sent": True
    }
    alert_log.append(alert)

    # Console alert (replace with email/SMS in production)
    logger.warning(
        f"🚨 ALERT | {alert['risk_level']} RISK | "
        f"Student {alert['student_id']} | "
        f"Dept: {alert['department']} | "
        f"Probability: {alert['risk_probability']:.2%} | "
        f"Top factor: {alert['top_factors'][0]['feature'] if alert['top_factors'] else 'N/A'}"
    )


@app.get("/alerts")
def get_alerts(limit: int = 20):
    """Get recent alerts."""
    return {
        "success": True,
        "total_alerts": len(alert_log),
        "alerts": list(reversed(alert_log))[:limit]
    }


@app.post("/alerts/send-batch-report")
def send_batch_report():
    """Trigger batch alert for all critical/high risk students from predictions."""
    try:
        pred_df = pd.read_csv(os.path.join(MODEL_DIR, 'predictions.csv'))
        high_risk = pred_df[pred_df['risk_level'].isin(['Critical', 'High'])]

        sent_count = 0
        for _, row in high_risk.iterrows():
            alert_data = {
                'student_id': row['student_id'],
                'risk_level': row['risk_level'],
                'risk_probability': row['risk_probability'],
                'department': row['department'],
                'semester': row['semester'],
                'top_risk_factors': []
            }
            trigger_alert(alert_data)
            sent_count += 1

        return {
            "success": True,
            "message": f"Batch alert sent for {sent_count} students",
            "critical_count": int((high_risk['risk_level'] == 'Critical').sum()),
            "high_count": int((high_risk['risk_level'] == 'High').sum()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
