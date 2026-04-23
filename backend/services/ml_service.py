"""
ML Service: prediction engine, SHAP explainability, model metrics.
Trains or loads XGBoost + SMOTE pipeline.
"""

import os
import json
import logging
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml")
os.makedirs(ML_DIR, exist_ok=True)

FEATURE_COLS = [
    "attendance_pct", "internal_marks", "assignment_submission_rate",
    "prev_semester_cgpa", "lab_attendance_pct", "quiz_avg_score",
    "library_visits_per_month", "extracurricular_participation", "active_backlogs",
    "dept_enc", "semester"
]

DEPT_MAP = {"CSE": 0, "ISE": 1, "AIML": 2, "ECE": 3, "EEE": 4, "MECH": 5, "CIVIL": 6}

_pipeline = None
_explainer = None
_model_meta: Dict = {}


def _load_artifacts():
    global _pipeline, _explainer, _model_meta
    pipeline_path = os.path.join(ML_DIR, "risk_pipeline.pkl")
    explainer_path = os.path.join(ML_DIR, "shap_explainer.pkl")
    meta_path = os.path.join(ML_DIR, "model_meta.json")

    if os.path.exists(pipeline_path):
        _pipeline = joblib.load(pipeline_path)
        logger.info("✅ ML pipeline loaded.")
    if os.path.exists(explainer_path):
        _explainer = joblib.load(explainer_path)
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            _model_meta = json.load(f)


def train_model(df: pd.DataFrame) -> Dict:
    """Train XGBoost + SMOTE pipeline on provided dataframe."""
    import warnings
    warnings.filterwarnings("ignore")

    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import (
        f1_score, roc_auc_score, precision_score, recall_score,
        average_precision_score, confusion_matrix
    )
    from sklearn.preprocessing import LabelEncoder
    from xgboost import XGBClassifier
    from imblearn.over_sampling import SMOTE
    from imblearn.pipeline import Pipeline as ImbPipeline
    import shap

    global _pipeline, _explainer, _model_meta

    df = df.copy()
    df["dept_enc"] = df["department"].map(DEPT_MAP).fillna(0).astype(int)
    df["extracurricular_participation"] = df["extracurricular_participation"].astype(int)

    X = df[FEATURE_COLS]
    y = df["at_risk"]

    scale_pos_weight = max(1, (y == 0).sum() / max((y == 1).sum(), 1))

    xgb = XGBClassifier(
        n_estimators=400, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss", random_state=42, n_jobs=-1,
        verbosity=0,
    )
    smote = SMOTE(sampling_strategy=0.5, random_state=42, k_neighbors=5)
    pipeline = ImbPipeline([("smote", smote), ("model", xgb)])

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_probs = cross_val_predict(pipeline, X, y, cv=skf, method="predict_proba")[:, 1]

    # Tune threshold
    thresholds = np.arange(0.1, 0.9, 0.01)
    f1s = [f1_score(y, (cv_probs >= t).astype(int), zero_division=0) for t in thresholds]
    best_t = float(thresholds[np.argmax(f1s)])
    best_preds = (cv_probs >= best_t).astype(int)

    cm = confusion_matrix(y, best_preds).tolist()

    pipeline.fit(X, y)
    final_model = pipeline.named_steps["model"]

    explainer = shap.TreeExplainer(final_model)
    shap_vals = explainer.shap_values(X)
    mean_abs_shap = np.abs(shap_vals).mean(axis=0)
    feature_importance = [
        {"feature": f, "importance": round(float(v), 5)}
        for f, v in sorted(zip(FEATURE_COLS, mean_abs_shap), key=lambda x: -x[1])
    ]

    version = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    meta = {
        "model_version": version,
        "f1_score": float(max(f1s)),
        "auc_roc": float(roc_auc_score(y, cv_probs)),
        "precision": float(precision_score(y, best_preds, zero_division=0)),
        "recall": float(recall_score(y, best_preds, zero_division=0)),
        "avg_precision": float(average_precision_score(y, cv_probs)),
        "threshold": best_t,
        "n_samples": int(len(y)),
        "n_at_risk": int(y.sum()),
        "confusion_matrix": cm,
        "feature_importance": feature_importance,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    joblib.dump(pipeline, os.path.join(ML_DIR, "risk_pipeline.pkl"))
    joblib.dump(explainer, os.path.join(ML_DIR, "shap_explainer.pkl"))
    with open(os.path.join(ML_DIR, "model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    _pipeline = pipeline
    _explainer = explainer
    _model_meta = meta

    logger.info(f"✅ Model trained: F1={meta['f1_score']:.4f}, AUC={meta['auc_roc']:.4f}")
    return meta


def get_model_meta() -> Dict:
    if not _model_meta:
        _load_artifacts()
    return _model_meta


def predict_students(students_data: List[Dict]) -> List[Dict]:
    """
    Predict risk for a list of student dicts.
    Returns list of dicts with risk_probability, risk_level, top_risk_factors.
    """
    global _pipeline, _explainer, _model_meta

    if _pipeline is None:
        _load_artifacts()
    if _pipeline is None:
        raise RuntimeError("ML model not trained. Run /api/ml/train first.")

    df = pd.DataFrame(students_data)
    df["dept_enc"] = df["department"].map(DEPT_MAP).fillna(0).astype(int)
    df["extracurricular_participation"] = df.get("extracurricular_participation", pd.Series([0]*len(df))).fillna(0).astype(int)

    # Fill missing features
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = 0

    X = df[FEATURE_COLS]
    threshold = _model_meta.get("threshold", 0.3)
    proba = _pipeline.predict_proba(X)[:, 1]

    shap_vals = None
    if _explainer is not None:
        try:
            shap_vals = _explainer.shap_values(X)
        except Exception:
            pass

    results = []
    for i in range(len(df)):
        p = float(proba[i])
        if p >= 0.75:
            level = "Critical"
        elif p >= 0.55:
            level = "High"
        elif p >= 0.30:
            level = "Medium"
        else:
            level = "Low"

        top_factors = []
        if shap_vals is not None:
            sv = shap_vals[i]
            sorted_idx = np.argsort(np.abs(sv))[::-1][:5]
            for idx in sorted_idx:
                top_factors.append({
                    "feature": FEATURE_COLS[idx],
                    "shap_value": round(float(sv[idx]), 4),
                    "impact": "increases" if sv[idx] > 0 else "decreases",
                    "value": round(float(X.iloc[i][FEATURE_COLS[idx]]), 2),
                })

        results.append({
            "risk_probability": round(p, 4),
            "risk_level": level,
            "predicted_at_risk": p >= threshold,
            "top_risk_factors": top_factors,
            "model_version": _model_meta.get("model_version", "unknown"),
        })

    return results


def predict_single(student_dict: Dict) -> Dict:
    return predict_students([student_dict])[0]


# Load on import
_load_artifacts()
