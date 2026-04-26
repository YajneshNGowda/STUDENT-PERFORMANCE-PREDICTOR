"""
Alert Service v2.1 — fully automated, no manual trigger needed.
Detects: low_attendance, poor_marks, consecutive_failure,
         performance_drop, high_risk_score, multiple_backlogs
Sends to: faculty email + parent email
"""
import os, logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL       = os.getenv("FROM_EMAIL", "alerts@eduguard.edu")
TWILIO_SID       = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN     = os.getenv("TWILIO_AUTH_TOKEN",  "")
TWILIO_FROM      = os.getenv("TWILIO_PHONE_FROM",  "")

ALERT_THRESHOLDS = {
    "attendance":  75.0,   # below this → low_attendance
    "marks":       40.0,   # below this → poor_marks
    "backlogs":    2,      # above this → multiple_backlogs
    "cgpa":        5.0,    # below this → performance_drop
    "risk_high":   0.55,   # above this → high_risk_score
    "risk_critical": 0.75,
}

CONDITION_LABELS = {
    "low_attendance":      "Low Attendance (< 75%)",
    "poor_marks":          "Poor Internal Marks (< 40)",
    "consecutive_failure": "Consecutive Failures / Active Backlogs ≥ 2",
    "performance_drop":    "Performance Drop (CGPA < 5.0)",
    "high_risk_score":     "High Risk Score (≥ 55%)",
    "multiple_backlogs":   "Multiple Active Backlogs",
}


def evaluate_alert_conditions(student) -> List[str]:
    """Evaluate which alert conditions are triggered for a student."""
    conditions = []
    if student.attendance_pct < ALERT_THRESHOLDS["attendance"]:
        conditions.append("low_attendance")
    if student.internal_marks < ALERT_THRESHOLDS["marks"]:
        conditions.append("poor_marks")
    if student.active_backlogs >= ALERT_THRESHOLDS["backlogs"]:
        conditions.append("consecutive_failure")
        if student.active_backlogs > 3:
            conditions.append("multiple_backlogs")
    if student.prev_semester_cgpa < ALERT_THRESHOLDS["cgpa"] and student.prev_semester_cgpa > 0:
        conditions.append("performance_drop")
    return list(set(conditions))


def _build_email(student, prediction: dict, conditions: List[str],
                 recipient_type: str) -> tuple[str, str]:
    cond_html = "".join([
        f"<li>⚠️ <b>{CONDITION_LABELS.get(c, c)}</b></li>" for c in conditions
    ])
    risk_color = {
        "Critical": "#dc2626", "High": "#ea580c",
        "Medium": "#d97706",   "Low": "#16a34a",
    }.get(prediction["risk_level"], "#64748b")

    if "high_risk_score" not in conditions and prediction["risk_probability"] >= ALERT_THRESHOLDS["risk_high"]:
        conditions.append("high_risk_score")

    top_factors_html = ""
    for f in (prediction.get("top_risk_factors") or [])[:3]:
        feat = f["feature"].replace("_", " ").title()
        direction = "↑ increases" if f["impact"] == "increases" else "↓ decreases"
        top_factors_html += f"<li><b>{feat}</b>: {direction} risk (SHAP: {f['shap_value']:+.3f})</li>"

    greeting = "Dear Parent/Guardian," if recipient_type == "parent" else "Dear Faculty,"
    intro = (
        f"Your ward <b>{student.full_name}</b> (USN: <b>{student.usn or student.student_id}</b>) "
        f"has been flagged as <b style='color:{risk_color}'>{prediction['risk_level']} Risk</b>."
        if recipient_type == "parent"
        else f"Student <b>{student.full_name}</b> (USN: <b>{student.usn or student.student_id}</b>) "
             f"in your assigned class has been flagged as <b style='color:{risk_color}'>{prediction['risk_level']} Risk</b>."
    )

    subject = (
        f"[EduGuard] Academic Alert — {student.full_name} ({student.usn or student.student_id})"
    )
    body = f"""
<div style="font-family:sans-serif;max-width:640px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="background:{risk_color};padding:20px 24px;">
    <h2 style="color:white;margin:0;">🚨 Student Academic Risk Alert</h2>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;">EduGuard Early Warning System</p>
  </div>
  <div style="padding:24px;">
    <p>{greeting}</p>
    <p>{intro}</p>
    <p><b>Risk Probability:</b> {prediction['risk_probability']:.1%}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;"><b>Attendance</b></td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.attendance_pct:.1f}%</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;"><b>Internal Marks</b></td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.internal_marks:.1f}/100</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;"><b>Assignment Rate</b></td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.assignment_submission_rate:.1f}%</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;"><b>CGPA</b></td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.prev_semester_cgpa:.2f}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;"><b>Active Backlogs</b></td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.active_backlogs}</td></tr>
    </table>
    <p><b>Alert Conditions Detected:</b></p><ul>{cond_html}</ul>
    {"<p><b>Top Contributing Factors:</b></p><ul>" + top_factors_html + "</ul>" if top_factors_html else ""}
    <div style="background:#fef2f2;border-left:4px solid {risk_color};padding:12px;border-radius:4px;margin-top:16px;">
      <b>Recommended Action:</b> Please schedule an immediate counseling/support session.
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:12px;color:#94a3b8;">
    This alert was automatically generated by EduGuard. No manual action was required.
  </div>
</div>"""
    return subject, body


def _send_email(to: str, subject: str, body: str) -> bool:
    if not SENDGRID_API_KEY:
        logger.warning(f"📧 [CONSOLE-ONLY] Email to {to} | {subject}")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        msg = Mail(from_email=FROM_EMAIL, to_emails=to, subject=subject, html_content=body)
        SendGridAPIClient(SENDGRID_API_KEY).send(msg)
        logger.info(f"📧 Email sent → {to}")
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


def create_and_fire_alert(
    db: Session, student, prediction: dict,
    trigger_reason: str = "update",
) -> Optional[object]:
    """
    Evaluates alert conditions and fires email to faculty + parent.
    Fires for ALL risk levels that have at least one condition triggered.
    Always fires for High/Critical regardless of conditions.
    """
    from ..models.database import Alert, AlertStatus, RiskLevel, User

    risk_level = prediction["risk_level"]
    conditions = evaluate_alert_conditions(student)

    if prediction["risk_probability"] >= ALERT_THRESHOLDS["risk_high"]:
        conditions.append("high_risk_score")
    conditions = list(set(conditions))

    # Only alert if High/Critical OR has specific condition triggers
    if risk_level not in ("High", "Critical") and not conditions:
        return None

    alert = Alert(
        student_id=student.id,
        risk_level=RiskLevel(risk_level),
        risk_probability=prediction["risk_probability"],
        conditions=conditions,
        message=f"{student.full_name} ({student.usn}) flagged as {risk_level} risk. "
                f"Conditions: {', '.join(CONDITION_LABELS.get(c,c) for c in conditions)}",
        status=AlertStatus.PENDING,
        trigger_reason=trigger_reason,
    )
    db.add(alert)
    db.flush()

    sent_any = False

    # 1. Email faculty
    faculty_email = None
    if student.assigned_faculty_id:
        fac = db.query(User).filter_by(id=student.assigned_faculty_id).first()
        if fac:
            faculty_email = fac.email
    else:
        # find HOD of dept
        from ..models.database import UserRole
        hod = db.query(User).filter_by(department_id=student.department_id, role=UserRole.HOD).first()
        if hod:
            faculty_email = hod.email

    if faculty_email:
        subj, body = _build_email(student, prediction, conditions, "faculty")
        ok = _send_email(faculty_email, subj, body)
        alert.sent_to_faculty_email = faculty_email
        if ok: sent_any = True

    # 2. Email parent
    if student.parent_email:
        subj, body = _build_email(student, prediction, conditions, "parent")
        ok = _send_email(student.parent_email, subj, body)
        alert.sent_to_parent_email = student.parent_email
        if ok: sent_any = True

    alert.status = AlertStatus.SENT if sent_any else AlertStatus.PENDING
    logger.warning(
        f"🚨 ALERT [{risk_level}] {student.usn or student.student_id} | "
        f"Conditions: {conditions} | Trigger: {trigger_reason}"
    )
    return alert


def fire_batch_alerts(db: Session, students: list, predictions: list,
                      trigger_reason: str = "batch") -> int:
    count = 0
    for student, pred in zip(students, predictions):
        alert = create_and_fire_alert(db, student, pred, trigger_reason)
        if alert:
            count += 1
    db.commit()
    return count
