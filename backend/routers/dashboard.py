"""Dashboard, ML, Alerts, Departments routers v2.1"""
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
from ..models.schemas import ModelMetricsOut, DepartmentOut
from ..utils.security import get_current_user_payload

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
ml_router        = APIRouter(prefix="/api/ml",        tags=["ML"])
alerts_router    = APIRouter(prefix="/api/alerts",    tags=["Alerts"])
dept_router      = APIRouter(prefix="/api/departments", tags=["Departments"])


def _base_q(db, payload):
    q = db.query(Student).filter_by(is_active=True)
    role = payload.get("role")
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        if payload.get("dept_id"):
            q = q.filter(Student.department_id == payload["dept_id"])
    elif role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        sid = payload.get("student_db_id")
        if sid:
            q = q.filter(Student.id == sid)
        else:
            q = q.filter(Student.id == -1)
    return q


@dashboard_router.get("/overview")
def overview(db: Session = Depends(get_db), payload=Depends(get_current_user_payload)):
    students = _base_q(db, payload).all()
    ids = [s.id for s in students]

    if not ids:
        return {
            "total_students": 0, "at_risk_count": 0, "critical_count": 0,
            "high_count": 0, "medium_count": 0, "low_count": 0, "at_risk_pct": 0,
            "total_alerts_today": 0, "unacknowledged_alerts": 0,
            "departments": [], "risk_trend": [],
            "last_model_trained": None, "model_f1": None, "model_auc": None,
        }

    # Latest pred per student
    sub = (db.query(Prediction.student_id, func.max(Prediction.created_at).label("mx"))
             .filter(Prediction.student_id.in_(ids))
             .group_by(Prediction.student_id).subquery())
    latest_preds = (db.query(Prediction)
        .join(sub, and_(Prediction.student_id == sub.c.student_id,
                        Prediction.created_at == sub.c.mx)).all())

    counts = {"Critical":0,"High":0,"Medium":0,"Low":0}
    for p in latest_preds:
        counts[p.risk_level.value] = counts.get(p.risk_level.value,0)+1

    at_risk = counts["Critical"]+counts["High"]
    today_start = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
    alerts_today = db.query(Alert).filter(
        Alert.student_id.in_(ids), Alert.created_at>=today_start).count()
    unack = db.query(Alert).filter(
        Alert.student_id.in_(ids),
        Alert.status.in_([AlertStatus.PENDING,AlertStatus.SENT])).count()

    # Per-dept breakdown
    dept_map  = {d.id: d for d in db.query(Department).all()}
    dept_stats = {}
    for s in students:
        d = dept_map.get(s.department_id)
        code = d.code if d else "?"
        if code not in dept_stats:
            dept_stats[code] = {"code":code,"name":d.name if d else code,"total":0,"at_risk":0,"critical":0}
        dept_stats[code]["total"] += 1
    pred_by_sid = {p.student_id: p for p in latest_preds}
    for s in students:
        d = dept_map.get(s.department_id)
        code = d.code if d else "?"
        p = pred_by_sid.get(s.id)
        if p and p.risk_level.value in ("High","Critical"):
            dept_stats[code]["at_risk"] += 1
        if p and p.risk_level.value == "Critical":
            dept_stats[code]["critical"] += 1
    for v in dept_stats.values():
        v["risk_pct"] = round(v["at_risk"]/v["total"]*100,1) if v["total"] else 0

    # 7-day trend
    trend = []
    for i in range(6,-1,-1):
        day = datetime.now(timezone.utc) - timedelta(days=i)
        ds  = day.replace(hour=0,minute=0,second=0,microsecond=0)
        de  = ds + timedelta(days=1)
        cnt = db.query(Prediction).filter(
            Prediction.student_id.in_(ids),
            Prediction.created_at>=ds, Prediction.created_at<de,
            Prediction.risk_level.in_([RiskLevel.HIGH,RiskLevel.CRITICAL])).count()
        trend.append({"date":ds.strftime("%b %d"),"at_risk":cnt})

    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()
    return {
        "total_students": len(students), "at_risk_count": at_risk,
        "critical_count": counts["Critical"], "high_count": counts["High"],
        "medium_count": counts["Medium"], "low_count": counts["Low"],
        "at_risk_pct": round(at_risk/len(students)*100,2) if students else 0,
        "total_alerts_today": alerts_today, "unacknowledged_alerts": unack,
        "departments": list(dept_stats.values()), "risk_trend": trend,
        "last_model_trained": meta.trained_at.isoformat() if meta else None,
        "model_f1":  meta.f1_score  if meta else None,
        "model_auc": meta.auc_roc   if meta else None,
    }


# ── ML ─────────────────────────────────────────────────────────────────────────
@ml_router.post("/train")
def train_model(bg: BackgroundTasks, db: Session = Depends(get_db),
                payload=Depends(get_current_user_payload)):
    if payload["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")

    def _do():
        from ..services.ml_service import train_model as _train
        from ..models.connection import get_db_context
        from data.generator import generate_student_data
        with get_db_context() as db2:
            students = db2.query(Student).filter_by(is_active=True).all()
            if len(students) < 50:
                df = generate_student_data(1200)
            else:
                import pandas as pd
                rows = []
                for s in students:
                    code = s.department.code if s.department else "CS"
                    lp = db2.query(Prediction).filter_by(student_id=s.id).order_by(desc(Prediction.created_at)).first()
                    rows.append({
                        "department":code,"semester":s.semester,
                        "attendance_pct":s.attendance_pct,"internal_marks":s.internal_marks,
                        "assignment_submission_rate":s.assignment_submission_rate,
                        "prev_semester_cgpa":s.prev_semester_cgpa,
                        "lab_attendance_pct":s.lab_attendance_pct,
                        "quiz_avg_score":s.quiz_avg_score,
                        "library_visits_per_month":s.library_visits_per_month,
                        "extracurricular_participation":int(s.extracurricular_participation),
                        "active_backlogs":s.active_backlogs,
                        "at_risk":int(lp.predicted_at_risk) if lp else 0,
                    })
                df = pd.DataFrame(rows)
            meta = _train(df)
            db2.query(ModelMetrics).filter_by(is_active=True).update({"is_active":False})
            db2.add(ModelMetrics(
                model_version=meta["model_version"], f1_score=meta["f1_score"],
                auc_roc=meta["auc_roc"], precision=meta["precision"],
                recall=meta["recall"], avg_precision=meta["avg_precision"],
                threshold=meta["threshold"], n_samples=meta["n_samples"],
                n_at_risk=meta["n_at_risk"], confusion_matrix=meta["confusion_matrix"],
                feature_importance=meta["feature_importance"], is_active=True,
            ))
            db2.add(AuditLog(action="train_model",details={"f1":meta["f1_score"]}))
    bg.add_task(_do)
    return {"message":"Model training started in background"}


@ml_router.get("/metrics", response_model=ModelMetricsOut)
def get_metrics(db: Session = Depends(get_db), payload=Depends(get_current_user_payload)):
    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()
    if not meta:
        raise HTTPException(status_code=404, detail="No model trained yet.")
    return meta


@ml_router.get("/feature-importance")
def feature_importance(db: Session = Depends(get_db), payload=Depends(get_current_user_payload)):
    meta = db.query(ModelMetrics).filter_by(is_active=True).order_by(desc(ModelMetrics.trained_at)).first()
    if not meta:
        raise HTTPException(status_code=404, detail="No model metrics available")
    return {"feature_importance": meta.feature_importance}


# ── Alerts ─────────────────────────────────────────────────────────────────────
@alerts_router.get("")
def list_alerts(
    status_filter: Optional[str] = None,
    risk_level: Optional[str] = None,
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    payload=Depends(get_current_user_payload),
):
    role = payload.get("role")
    # Students/parents cannot see alert list
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Access denied")

    q = db.query(Alert).join(Student, Alert.student_id==Student.id)
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        if payload.get("dept_id"):
            q = q.filter(Student.department_id==payload["dept_id"])
    if status_filter: q = q.filter(Alert.status==status_filter)
    if risk_level:    q = q.filter(Alert.risk_level==risk_level)

    total  = q.count()
    alerts = q.order_by(desc(Alert.created_at)).offset(skip).limit(limit).all()
    return {
        "total": total,
        "alerts": [{
            "id": a.id, "student_id": a.student_id,
            "student_name": a.student.full_name if a.student else None,
            "student_usn":  a.student.usn       if a.student else None,
            "department":   a.student.department.code if a.student and a.student.department else None,
            "risk_level":   a.risk_level.value,
            "risk_probability": a.risk_probability,
            "conditions":   a.conditions,
            "status":       a.status.value,
            "trigger_reason": a.trigger_reason,
            "sent_to_faculty_email": a.sent_to_faculty_email,
            "sent_to_parent_email":  a.sent_to_parent_email,
            "created_at":   a.created_at.isoformat(),
        } for a in alerts],
    }


@alerts_router.post("/{alert_id}/acknowledge")
def acknowledge(alert_id: int, db: Session = Depends(get_db),
                payload=Depends(get_current_user_payload)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Access denied")
    alert = db.query(Alert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status           = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by  = int(payload["sub"])
    alert.acknowledged_at  = datetime.now(timezone.utc)
    db.commit()
    return {"message":"Alert acknowledged"}


# ── Departments ─────────────────────────────────────────────────────────────────
@dept_router.get("", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db), payload=Depends(get_current_user_payload)):
    depts  = db.query(Department).filter_by(is_active=True).all()
    result = []
    for d in depts:
        total   = db.query(Student).filter_by(department_id=d.id,is_active=True).count()
        sids    = [s.id for s in db.query(Student.id).filter_by(department_id=d.id,is_active=True)]
        at_risk = 0
        if sids:
            sub = (db.query(Prediction.student_id, func.max(Prediction.created_at).label("mx"))
                     .filter(Prediction.student_id.in_(sids))
                     .group_by(Prediction.student_id).subquery())
            at_risk = (db.query(Prediction)
                .join(sub, and_(Prediction.student_id==sub.c.student_id,
                                Prediction.created_at==sub.c.mx))
                .filter(Prediction.risk_level.in_([RiskLevel.HIGH,RiskLevel.CRITICAL]))
                .count())
        result.append(DepartmentOut(
            id=d.id, code=d.code, name=d.name,
            description=d.description, is_active=d.is_active,
            student_count=total, at_risk_count=at_risk,
        ))
    return result
