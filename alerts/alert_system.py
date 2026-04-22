"""
Automated Alert System
Supports: Console log, Email (SendGrid), SMS (Twilio), Slack webhook
Configure via environment variables or alerts/config.py
"""

import os
import logging
from datetime import datetime
from typing import List, Dict, Optional
import json

logger = logging.getLogger(__name__)

# ── Config from environment ───────────────────────────────────────────────────
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', 'alerts@eduguard.app')
FACULTY_EMAIL = os.getenv('FACULTY_EMAIL', 'faculty@college.edu')

TWILIO_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM = os.getenv('TWILIO_PHONE_FROM', '')
FACULTY_PHONE = os.getenv('FACULTY_PHONE', '')

SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')

# ── In-memory alert log ───────────────────────────────────────────────────────
_alert_store: List[Dict] = []


def build_alert_message(student: Dict) -> str:
    """Build a structured alert message."""
    factors = student.get('top_risk_factors', [])[:3]
    factors_str = '\n'.join([
        f"  • {f['feature']}: SHAP={f['shap_value']:+.3f} ({f['impact']} risk)"
        for f in factors
    ]) if factors else "  • No SHAP data available"

    return f"""
🚨 STUDENT AT-RISK ALERT
========================
Student ID   : {student.get('student_id', 'N/A')}
Department   : {student.get('department', 'N/A')}
Semester     : {student.get('semester', 'N/A')}
Risk Level   : {student.get('risk_level', 'N/A')} ({student.get('risk_probability', 0):.1%} probability)
Timestamp    : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Top Contributing Factors:
{factors_str}

Recommended Action: Schedule immediate counseling session.
========================
""".strip()


def send_console_alert(student: Dict):
    """Always-available console alert."""
    msg = build_alert_message(student)
    logger.warning(f"\n{msg}")
    _alert_store.append({
        'timestamp': datetime.now().isoformat(),
        'channel': 'console',
        'student': student,
        'message': msg,
        'status': 'sent'
    })


def send_email_alert(student: Dict, to_email: Optional[str] = None):
    """
    Send email alert via SendGrid.
    Requires: pip install sendgrid
    Set env: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, FACULTY_EMAIL
    """
    if not SENDGRID_API_KEY:
        logger.info("SendGrid not configured — skipping email alert")
        return False

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        recipient = to_email or FACULTY_EMAIL
        msg = build_alert_message(student)

        email = Mail(
            from_email=SENDGRID_FROM_EMAIL,
            to_emails=recipient,
            subject=f"[EduGuard] {student.get('risk_level')} Risk Alert — {student.get('student_id')}",
            plain_text_content=msg
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(email)
        logger.info(f"📧 Email sent to {recipient} for {student.get('student_id')}")
        return True
    except Exception as e:
        logger.error(f"Email alert failed: {e}")
        return False


def send_sms_alert(student: Dict, to_phone: Optional[str] = None):
    """
    Send SMS alert via Twilio.
    Requires: pip install twilio
    Set env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM, FACULTY_PHONE
    """
    if not (TWILIO_SID and TWILIO_TOKEN):
        logger.info("Twilio not configured — skipping SMS alert")
        return False

    try:
        from twilio.rest import Client

        recipient = to_phone or FACULTY_PHONE
        short_msg = (
            f"[EduGuard] {student.get('risk_level')} Risk: {student.get('student_id')} "
            f"({student.get('department')}, Sem {student.get('semester')}) "
            f"— Risk: {student.get('risk_probability', 0):.1%}. Check dashboard."
        )
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        client.messages.create(body=short_msg, from_=TWILIO_FROM, to=recipient)
        logger.info(f"📱 SMS sent to {recipient}")
        return True
    except Exception as e:
        logger.error(f"SMS alert failed: {e}")
        return False


def send_slack_alert(student: Dict):
    """
    Send Slack webhook alert.
    Set env: SLACK_WEBHOOK_URL
    """
    if not SLACK_WEBHOOK_URL:
        logger.info("Slack webhook not configured — skipping")
        return False

    try:
        import requests
        color = {
            'Critical': '#e53e3e',
            'High': '#f6ad55',
            'Medium': '#4299e1',
            'Low': '#48bb78'
        }.get(student.get('risk_level', ''), '#a0aec0')

        payload = {
            "attachments": [{
                "color": color,
                "title": f"🚨 {student.get('risk_level')} Risk Alert — {student.get('student_id')}",
                "fields": [
                    {"title": "Department", "value": student.get('department', 'N/A'), "short": True},
                    {"title": "Semester", "value": str(student.get('semester', 'N/A')), "short": True},
                    {"title": "Risk Probability", "value": f"{student.get('risk_probability', 0):.1%}", "short": True},
                    {"title": "Risk Level", "value": student.get('risk_level', 'N/A'), "short": True},
                ],
                "footer": "EduGuard Early Warning System",
                "ts": int(datetime.now().timestamp())
            }]
        }
        requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=5)
        logger.info("📣 Slack alert sent")
        return True
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        return False


def fire_all_alerts(student: Dict):
    """
    Master alert function — fires all configured channels.
    Console is always active; email/SMS/Slack require env vars.
    """
    send_console_alert(student)
    send_email_alert(student)
    send_sms_alert(student)
    send_slack_alert(student)


def fire_batch_alerts(students: List[Dict], risk_levels: List[str] = ['Critical', 'High']):
    """Fire alerts for a batch of students filtered by risk level."""
    triggered = 0
    for s in students:
        if s.get('risk_level') in risk_levels:
            fire_all_alerts(s)
            triggered += 1
    logger.info(f"✅ Batch alerts complete: {triggered} alerts sent")
    return triggered


def get_alert_log() -> List[Dict]:
    """Return the in-memory alert log."""
    return list(reversed(_alert_store))


def export_alert_report(path: str = 'alerts_report.json'):
    """Export alert log to JSON file."""
    with open(path, 'w') as f:
        json.dump(_alert_store, f, indent=2)
    logger.info(f"Alert report exported to {path}")
