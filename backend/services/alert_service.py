"""
Alert Service v2.2
- Sends alerts to: Faculty/HOD email + Parent email + Student email
- Console fallback always prints clearly (no SendGrid needed for dev)
- Detects: low_attendance, poor_marks, consecutive_failure,
           performance_drop, high_risk_score, multiple_backlogs
"""
import os
import logging
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
    "attendance":    75.0,
    "marks":         40.0,
    "backlogs":      2,
    "cgpa":          5.0,
    "risk_high":     0.55,
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


def _build_html(student, prediction: dict, conditions: List[str], recipient_type: str) -> tuple[str, str]:
    risk_color = {
        "Critical": "#dc2626", "High": "#ea580c",
        "Medium":   "#d97706", "Low":  "#16a34a",
    }.get(prediction["risk_level"], "#64748b")

    cond_html = "".join([
        f"<li>⚠️ <b>{CONDITION_LABELS.get(c, c)}</b></li>" for c in conditions
    ]) or "<li>General academic risk detected</li>"

    top_html = ""
    for f in (prediction.get("top_risk_factors") or [])[:3]:
        feat = f["feature"].replace("_", " ").title()
        direction = "↑ increases" if f["impact"] == "increases" else "↓ decreases"
        top_html += f"<li><b>{feat}</b>: {direction} risk (SHAP: {f['shap_value']:+.3f})</li>"

    usn = student.usn or student.student_id

    if recipient_type == "student":
        greeting  = f"Dear {student.full_name},"
        intro_msg = (f"Your academic performance has been flagged as "
                     f"<b style='color:{risk_color}'>{prediction['risk_level']} Risk</b> "
                     f"with a risk probability of <b>{prediction['risk_probability']:.1%}</b>.")
        action_msg = "Please contact your faculty advisor immediately and attend the scheduled counseling session."
    elif recipient_type == "parent":
        greeting  = "Dear Parent/Guardian,"
        intro_msg = (f"Your ward <b>{student.full_name}</b> (USN: <b>{usn}</b>) "
                     f"has been flagged as <b style='color:{risk_color}'>{prediction['risk_level']} Risk</b> "
                     f"with a risk probability of <b>{prediction['risk_probability']:.1%}</b>.")
        action_msg = "Please speak with your ward and encourage them to attend the scheduled counseling session."
    else:
        greeting  = "Dear Faculty,"
        intro_msg = (f"Student <b>{student.full_name}</b> (USN: <b>{usn}</b>) "
                     f"has been flagged as <b style='color:{risk_color}'>{prediction['risk_level']} Risk</b> "
                     f"with a risk probability of <b>{prediction['risk_probability']:.1%}</b>.")
        action_msg = "Please schedule an immediate counseling/support session with this student."

    subject = f"[EduGuard Alert] {prediction['risk_level']} Risk — {student.full_name} ({usn})"

    body = f"""
<div style="font-family:sans-serif;max-width:640px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="background:{risk_color};padding:20px 24px;">
    <h2 style="color:white;margin:0;">🚨 EduGuard Academic Risk Alert</h2>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Automated Early Warning System</p>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;">{greeting}</p>
    <p style="font-size:14px;line-height:1.6;">{intro_msg}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">USN</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{usn}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Department</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.department.code if student.department else "N/A"}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Attendance</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:{'#dc2626' if student.attendance_pct<75 else '#16a34a'}">{student.attendance_pct:.1f}%</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Internal Marks</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:{'#dc2626' if student.internal_marks<40 else '#16a34a'}">{student.internal_marks:.1f}/100</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Assignment Rate</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.assignment_submission_rate:.1f}%</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">CGPA</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">{student.prev_semester_cgpa:.2f}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Active Backlogs</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:{'#dc2626' if student.active_backlogs>0 else '#16a34a'}">{student.active_backlogs}</td></tr>
    </table>
    <p style="font-size:14px;font-weight:600;margin-top:16px;">⚠ Alert Conditions Detected:</p>
    <ul style="font-size:13px;line-height:1.8;">{cond_html}</ul>
    {"<p style='font-size:14px;font-weight:600;'>Top Risk Factors:</p><ul style='font-size:13px;line-height:1.8;'>" + top_html + "</ul>" if top_html else ""}
    <div style="background:#fef2f2;border-left:4px solid {risk_color};padding:14px;border-radius:6px;margin-top:20px;font-size:13px;">
      <b>📋 Recommended Action:</b> {action_msg}
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
      Generated: {datetime.now().strftime('%d %b %Y %H:%M')} IST |
      Risk Score: {prediction['risk_probability']:.1%} |
      Trigger: Automated
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center;">
    This alert was automatically generated by EduGuard Early Warning System. No manual action was needed.
  </div>
</div>"""
    return subject, body


def _log_console_alert(to: str, subject: str, student, prediction: dict, recipient_type: str):
    """Always-visible console alert — used when SendGrid is not configured."""
    sep = "=" * 70
    print(f"\n{sep}")
    print(f"  📧 EMAIL ALERT [{recipient_type.upper()}]")
    print(f"  To      : {to}")
    print(f"  Subject : {subject}")
    print(f"  Student : {student.full_name} ({student.usn or student.student_id})")
    print(f"  Risk    : {prediction['risk_level']} ({prediction['risk_probability']:.1%})")
    print(f"  Time    : {datetime.now().strftime('%d %b %Y %H:%M:%S')}")
    print(f"{sep}\n")
    logger.warning(
        f"📧 ALERT [{prediction['risk_level']}] → {to} | "
        f"{student.full_name} ({student.usn}) | "
        f"Risk: {prediction['risk_probability']:.1%}"
    )


def _send_email(to: str, subject: str, body: str,
                student=None, prediction: dict = None, recipient_type: str = "faculty") -> bool:
    """Send email via SendGrid. Falls back to console if not configured."""
    # Always log to console
    if student and prediction:
        _log_console_alert(to, subject, student, prediction, recipient_type)

    if not SENDGRID_API_KEY:
        logger.info("ℹ️  SendGrid not configured — console alert shown above.")
        return False

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        msg = Mail(from_email=FROM_EMAIL, to_emails=to, subject=subject, html_content=body)
        SendGridAPIClient(SENDGRID_API_KEY).send(msg)
        logger.info(f"✅ Email delivered → {to}")
        return True
    except Exception as e:
        logger.error(f"❌ Email send failed to {to}: {e}")
        return False


def create_and_fire_alert(
    db: Session,
    student,
    prediction: dict,
    trigger_reason: str = "update",
) -> Optional[object]:
    """
    Evaluate conditions, create alert record, send emails to:
    1. Faculty (or HOD if no faculty assigned)
    2. Parent email
    3. Student email
    Fires for ALL High/Critical risk or any triggered conditions.
    """
    from ..models.database import Alert, AlertStatus, RiskLevel, User

    risk_level = prediction["risk_level"]
    conditions = evaluate_alert_conditions(student)

    if prediction["risk_probability"] >= ALERT_THRESHOLDS["risk_high"]:
        conditions.append("high_risk_score")
    conditions = list(set(conditions))

    # Only alert for High/Critical OR specific conditions triggered
    if risk_level not in ("High", "Critical") and not conditions:
        return None

    usn = student.usn or student.student_id

    alert = Alert(
        student_id=student.id,
        risk_level=RiskLevel(risk_level),
        risk_probability=prediction["risk_probability"],
        conditions=conditions,
        message=(
            f"{student.full_name} ({usn}) flagged as {risk_level} risk "
            f"({prediction['risk_probability']:.1%}). "
            f"Conditions: {', '.join(CONDITION_LABELS.get(c, c) for c in conditions)}"
        ),
        status=AlertStatus.PENDING,
        trigger_reason=trigger_reason,
    )
    db.add(alert)
    db.flush()

    sent_count = 0

    # ── 1. Faculty / HOD email ────────────────────────────────────────────────
    faculty_email = None
    faculty_name  = "Faculty"
    if student.assigned_faculty_id:
        fac = db.query(User).filter_by(id=student.assigned_faculty_id).first()
        if fac:
            faculty_email = fac.email
            faculty_name  = fac.full_name
    else:
        from ..models.database import UserRole
        hod = db.query(User).filter_by(
            department_id=student.department_id, role=UserRole.HOD
        ).first()
        if hod:
            faculty_email = hod.email
            faculty_name  = hod.full_name

    if faculty_email:
        subj, body = _build_html(student, prediction, conditions, "faculty")
        ok = _send_email(faculty_email, subj, body, student, prediction, "faculty")
        alert.sent_to_faculty_email = faculty_email
        if ok:
            sent_count += 1

    # ── 2. Parent email ───────────────────────────────────────────────────────
    if student.parent_email:
        subj, body = _build_html(student, prediction, conditions, "parent")
        ok = _send_email(student.parent_email, subj, body, student, prediction, "parent")
        alert.sent_to_parent_email = student.parent_email
        if ok:
            sent_count += 1
    else:
        # Still log that parent email is missing
        logger.info(
            f"ℹ️  No parent email for {usn} — add parent_email to student record to enable parent alerts."
        )

    # ── 3. Student email ──────────────────────────────────────────────────────
    if student.email:
        subj, body = _build_html(student, prediction, conditions, "student")
        ok = _send_email(student.email, subj, body, student, prediction, "student")
        if ok:
            sent_count += 1
    else:
        logger.info(
            f"ℹ️  No student email for {usn} — add email to student record to enable student alerts."
        )

    alert.status = AlertStatus.SENT if sent_count > 0 else AlertStatus.PENDING

    logger.warning(
        f"🚨 ALERT FIRED | [{risk_level}] {usn} | "
        f"Risk: {prediction['risk_probability']:.1%} | "
        f"Emails sent: {sent_count} | "
        f"Trigger: {trigger_reason} | "
        f"Conditions: {conditions}"
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
    logger.info(f"✅ Batch alerts complete: {count} alerts fired for trigger='{trigger_reason}'")
    return count
