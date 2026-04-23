"""
Background scheduler: daily risk scan + automated alerts at 8 AM IST.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
_scheduler: BackgroundScheduler = None


def run_daily_risk_scan():
    from backend.models.connection import get_db_context
    from backend.models.database import Student, Prediction, RiskLevel
    from backend.services.ml_service import predict_students
    from backend.services.alert_service import create_and_fire_alert

    logger.info("⏰ Daily risk scan starting…")
    with get_db_context() as db:
        students = db.query(Student).filter_by(is_active=True).all()
        if not students:
            return

        dicts = [{
            "department": s.department.code if s.department else "CSE",
            "semester": s.semester,
            "attendance_pct": s.attendance_pct,
            "internal_marks": s.internal_marks,
            "assignment_submission_rate": s.assignment_submission_rate,
            "prev_semester_cgpa": s.prev_semester_cgpa,
            "lab_attendance_pct": s.lab_attendance_pct,
            "quiz_avg_score": s.quiz_avg_score,
            "library_visits_per_month": s.library_visits_per_month,
            "extracurricular_participation": int(s.extracurricular_participation),
            "active_backlogs": s.active_backlogs,
        } for s in students]

        preds = predict_students(dicts)
        new_alerts = 0
        for student, pred in zip(students, preds):
            db.add(Prediction(
                student_id=student.id,
                risk_probability=pred["risk_probability"],
                risk_level=RiskLevel(pred["risk_level"]),
                predicted_at_risk=pred["predicted_at_risk"],
                top_risk_factors=pred["top_risk_factors"],
                model_version=pred.get("model_version"),
            ))
            alert = create_and_fire_alert(db, student, pred, trigger_reason="scheduler")
            if alert:
                new_alerts += 1

        logger.info(f"✅ Daily scan: {len(students)} students, {new_alerts} alerts fired.")


def _safe_scan():
    try:
        run_daily_risk_scan()
    except Exception as e:
        logger.error(f"❌ Daily scan failed: {e}", exc_info=True)


def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    _scheduler.add_job(_safe_scan, CronTrigger(hour=8, minute=0),
                       id="daily_risk_scan", replace_existing=True, misfire_grace_time=600)
    _scheduler.start()
    logger.info("✅ Scheduler started — daily scan at 08:00 IST.")
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def get_scheduler_status():
    if not _scheduler:
        return {"running": False, "jobs": []}
    return {
        "running": _scheduler.running,
        "jobs": [{"id": j.id, "name": j.name, "next_run": str(j.next_run_time)} for j in _scheduler.get_jobs()],
    }
