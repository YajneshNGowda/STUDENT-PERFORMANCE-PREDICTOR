"""
Dashboard analytics, ML training/metrics, alerts, departments routes.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from ..models.connection import get_db
from ..models.database import (
    Student, Prediction, Alert, AlertStatus, Department,
    User, UserRole, ModelMetrics, RiskLevel, AuditLog
)
from ..models.schemas import DashboardOverview, ModelMetricsOut, DepartmentOut
from ..utils.security import get_current_user_payload

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
ml_router = APIRouter(prefix="/api/ml", tags=["ML"])
alerts_router = APIRouter(prefix="/api/alerts", tags=["Alerts"])
dept_router = APIRouter(prefix="/api/departments", tags=["Departments"])


# ── Department visibility ─────────────────────────────────────────────────────
def _base_student_query(db, payload):
    q = db.query(Student).filter_by(is_active=True)
    role = payload.get("role")
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        dept_id = payload.get("dept_id")
        if dept_id:
            q = q.filter(Student.department_id == dept_id)
    return q


# ── Dashboard ─────────────────────────────────────────────────────────────────
@dashboard_router.get("/overview")
def dashboard_overview(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    students = _base_student_query(db, payload).all()
    student_ids = [s.id for s in students]

    if not student_ids:
        return {
            "total_students": 0, "at_risk_count": 0,
            "critical_count": 0, "high_count": 0, "medium_count": 0, "low_count": 0,
            "at_risk_pct": 0, "total_alerts_today": 0, "unacknowledged_alerts": 0,
            "departments": [], "risk_trend": [], "last_model_trained": None,
            "model_f1": None, "model_auc": None,
        }

    # Latest prediction per student (subquery)
    latest_pred_sub = (
        db.query(Prediction.student_id, func.max(Prediction.created_at).label("max_ts"))
        .filter(Prediction.student_id.in_(student_ids))
        .group_by(Prediction.student_id)
        .subquery()
    )
    latest_preds = (
        db.query(Prediction)
        .join(latest_pred_sub, and_(
            Prediction.student_id == latest_pred_sub.c.student_id,
            Prediction.created_at == latest_pred_sub.c.max_ts,
        ))
        .all()
    )

    counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "None": 0}
    for p in latest_preds:
        counts[p.risk_level.value] = counts.get(p.risk_level.value, 0) + 1
    counts["None"] = len(students) - len(latest_preds)

    at_risk = counts["Critical"] + counts["High"]
    total = len(students)

    # Alerts today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    alerts_today = (
        db.query(Alert)
        .filter(
            Alert.student_id.in_(student_ids),
            Alert.created_at >= today_start,
        )
        .count()
    )
    unack = (
        db.query(Alert)
        .filter(
            Alert.student_id.in_(student_ids),
            Alert.status.in_([AlertStatus.PENDING, AlertStatus.SENT]),
        )
        .count()
    )

    # Per-department breakdown
    dept_map = {d.id: d for d in db.query(Department).all()}
    dept_stats = {}
    for s in students:
        d = dept_map.get(s.department_id)
        code = d.code if d else "?"
        if code not in dept_stats:
            dept_stats[code] = {"code": code, "name": d.name if d else code,
                                 "total": 0, "at_risk": 0, "critical": 0}
        dept_stats[code]["total"] += 1

    pred_by_sid = {p.student_id: p for p in latest_preds}
    for s in students:
        d = dept_map.get(s.department_id)
        code = d.code if d else "?"
        p = pred_by_sid.get(s.id)
        if p and p.risk_level.value in ("High", "Critical"):
            dept_stats[code]["at_risk"] += 1
        if p and p.risk_level.value == "Critical":
            dept_stats[code]["critical"] += 1

    for v in dept_stats.values():
        v["risk_pct"] = round(v["at_risk"] / v["total"] * 100, 1) if v["total"] else 0

    # 7-day risk trend
    trend = []
    for i in range(6, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.query(Prediction).filter(
            Prediction.student_id.in_(student_ids),
            Prediction.created_at >= day_start,
            Prediction.created_at < day_end,
            Prediction.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]),
        ).count()
        trend.append({"date": day_start.strftime("%b %d"), "at_risk": count})

    # Model metrics
    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()

    return {
        "total_students": total,
        "at_risk_count": at_risk,
        "critical_count": counts["Critical"],
        "high_count": counts["High"],
        "medium_count": counts["Medium"],
        "low_count": counts["Low"],
        "at_risk_pct": round(at_risk / total * 100, 2) if total else 0,
        "total_alerts_today": alerts_today,
        "unacknowledged_alerts": unack,
        "departments": list(dept_stats.values()),
        "risk_trend": trend,
        "last_model_trained": meta.trained_at.isoformat() if meta else None,
        "model_f1": meta.f1_score if meta else None,
        "model_auc": meta.auc_roc if meta else None,
    }


# ── ML Routes ─────────────────────────────────────────────────────────────────
@ml_router.post("/train")
async def train_model(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    if payload["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin only")

    def do_train():
        import pandas as pd
        from ..services.ml_service import train_model as _train
        from ..models.connection import get_db_context

        with get_db_context() as db2:
            students = db2.query(Student).filter_by(is_active=True).all()
            if len(students) < 50:
                # Use synthetic data if not enough real data
                from ...data.generator import generate_student_data
                df = generate_student_data(1200)
            else:
                rows = []
                for s in students:
                    dept_code = s.department.code if s.department else "CSE"
                    lp = db2.query(Prediction).filter_by(student_id=s.id).order_by(desc(Prediction.created_at)).first()
                    rows.append({
                        "department": dept_code, "semester": s.semester,
                        "attendance_pct": s.attendance_pct, "internal_marks": s.internal_marks,
                        "assignment_submission_rate": s.assignment_submission_rate,
                        "prev_semester_cgpa": s.prev_semester_cgpa,
                        "lab_attendance_pct": s.lab_attendance_pct,
                        "quiz_avg_score": s.quiz_avg_score,
                        "library_visits_per_month": s.library_visits_per_month,
                        "extracurricular_participation": int(s.extracurricular_participation),
                        "active_backlogs": s.active_backlogs,
                        "at_risk": int(lp.predicted_at_risk) if lp else 0,
                    })
                df = pd.DataFrame(rows)

            meta = _train(df)
            # Deactivate old metrics
            db2.query(ModelMetrics).filter_by(is_active=True).update({"is_active": False})
            db2.add(ModelMetrics(
                model_version=meta["model_version"],
                f1_score=meta["f1_score"], auc_roc=meta["auc_roc"],
                precision=meta["precision"], recall=meta["recall"],
                avg_precision=meta["avg_precision"], threshold=meta["threshold"],
                n_samples=meta["n_samples"], n_at_risk=meta["n_at_risk"],
                confusion_matrix=meta["confusion_matrix"],
                feature_importance=meta["feature_importance"],
                is_active=True,
            ))
            db2.add(AuditLog(action="train_model", details={"f1": meta["f1_score"]}))

    background_tasks.add_task(do_train)
    return {"message": "Model training started in background"}


@ml_router.get("/metrics", response_model=ModelMetricsOut)
def get_metrics(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()
    if not meta:
        raise HTTPException(status_code=404, detail="No model trained yet. Run /api/ml/train first.")
    return meta


@ml_router.get("/feature-importance")
def get_feature_importance(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()
    if not meta:
        raise HTTPException(status_code=404, detail="No model metrics available")
    return {"feature_importance": meta.feature_importance}


# ── Alerts ────────────────────────────────────────────────────────────────────
@alerts_router.get("")
def list_alerts(
    status_filter: Optional[str] = None,
    risk_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    q = db.query(Alert).join(Student, Alert.student_id == Student.id)

    role = payload.get("role")
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        dept_id = payload.get("dept_id")
        if dept_id:
            q = q.filter(Student.department_id == dept_id)

    if status_filter:
        q = q.filter(Alert.status == status_filter)
    if risk_level:
        q = q.filter(Alert.risk_level == risk_level)

    total = q.count()
    alerts = q.order_by(desc(Alert.created_at)).offset(skip).limit(limit).all()

    return {
        "total": total,
        "alerts": [
            {
                "id": a.id,
                "student_id": a.student_id,
                "student_name": a.student.full_name if a.student else None,
                "student_code": a.student.student_id if a.student else None,
                "department": a.student.department.code if a.student and a.student.department else None,
                "risk_level": a.risk_level.value,
                "risk_probability": a.risk_probability,
                "status": a.status.value,
                "trigger_reason": a.trigger_reason,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@alerts_router.post("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    alert = db.query(Alert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = int(payload["sub"])
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Alert acknowledged"}


# ── Departments ───────────────────────────────────────────────────────────────
@dept_router.get("", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    depts = db.query(Department).filter_by(is_active=True).all()
    result = []
    for d in depts:
        total = db.query(Student).filter_by(department_id=d.id, is_active=True).count()
        # Count at-risk via latest predictions
        student_ids = [s.id for s in db.query(Student.id).filter_by(department_id=d.id, is_active=True)]
        at_risk = 0
        if student_ids:
            at_risk = db.query(Prediction).filter(
                Prediction.student_id.in_(student_ids),
                Prediction.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]),
            ).count()
        result.append(DepartmentOut(
            id=d.id, code=d.code, name=d.name,
            description=d.description, is_active=d.is_active,
            student_count=total, at_risk_count=at_risk,
        ))
    return result
