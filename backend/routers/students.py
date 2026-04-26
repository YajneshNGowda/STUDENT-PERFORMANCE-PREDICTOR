"""
Students router v2.1
- Faculty/HOD/Admin: full CRUD on own dept students
- Student role: read-only own record
- Parent role: read-only own child's record
- Individual risk analysis endpoint
- USN auto-generation in 4SNYYXX001 format
"""
import io, logging
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from ..models.connection import get_db
from ..models.database import (
    Student, Department, User, Prediction, Alert,
    RiskLevel, AuditLog, UserRole,
)
from ..models.schemas import StudentCreate, StudentUpdate, StudentOut
from ..utils.security import get_current_user_payload
from ..services.ml_service import predict_single, predict_students
from ..services.alert_service import create_and_fire_alert, evaluate_alert_conditions, CONDITION_LABELS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/students", tags=["Students"])

SEM_TO_BATCH = {1:25, 2:25, 3:24, 4:24, 5:23, 6:23, 7:22, 8:22}


def _generate_usn(dept_code: str, semester: int, db: Session) -> str:
    yy = SEM_TO_BATCH.get(semester, 22)
    prefix = f"4SN{yy}{dept_code}"
    existing = db.query(Student).filter(
        Student.usn.like(f"{prefix}%")
    ).count()
    return f"{prefix}{existing+1:03d}"


def _enrich(s: Student, db: Session) -> StudentOut:
    lp = (db.query(Prediction).filter_by(student_id=s.id)
            .order_by(desc(Prediction.created_at)).first())
    dept = s.department
    return StudentOut(
        id=s.id, student_id=s.student_id, usn=s.usn,
        full_name=s.full_name, email=s.email, phone=s.phone,
        parent_email=s.parent_email,
        department_id=s.department_id,
        department_code=dept.code if dept else None,
        department_name=dept.name if dept else None,
        semester=s.semester, section=s.section, batch_year=s.batch_year,
        attendance_pct=s.attendance_pct, internal_marks=s.internal_marks,
        assignment_submission_rate=s.assignment_submission_rate,
        prev_semester_cgpa=s.prev_semester_cgpa,
        lab_attendance_pct=s.lab_attendance_pct, quiz_avg_score=s.quiz_avg_score,
        library_visits_per_month=s.library_visits_per_month,
        extracurricular_participation=s.extracurricular_participation,
        active_backlogs=s.active_backlogs,
        assigned_faculty_id=s.assigned_faculty_id,
        latest_risk_level=lp.risk_level.value if lp else None,
        latest_risk_probability=lp.risk_probability if lp else None,
        alert_conditions=lp.alert_conditions if lp else None,
        created_at=s.created_at, updated_at=s.updated_at,
    )


def _dept_filter(q, payload: dict):
    role = payload.get("role")
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        if payload.get("dept_id"):
            q = q.filter(Student.department_id == payload["dept_id"])
    # super_admin sees all; student/parent handled separately
    return q


def _predict_and_save(student: Student, db: Session, trigger: str):
    dept_code = student.department.code if student.department else "CS"
    pred = predict_single({
        "department": dept_code, "semester": student.semester,
        "attendance_pct": student.attendance_pct,
        "internal_marks": student.internal_marks,
        "assignment_submission_rate": student.assignment_submission_rate,
        "prev_semester_cgpa": student.prev_semester_cgpa,
        "lab_attendance_pct": student.lab_attendance_pct,
        "quiz_avg_score": student.quiz_avg_score,
        "library_visits_per_month": student.library_visits_per_month,
        "extracurricular_participation": int(student.extracurricular_participation),
        "active_backlogs": student.active_backlogs,
    })
    conditions = evaluate_alert_conditions(student)
    if pred["risk_probability"] >= 0.55:
        conditions.append("high_risk_score")
    conditions = list(set(conditions))

    db_pred = Prediction(
        student_id=student.id,
        risk_probability=pred["risk_probability"],
        risk_level=RiskLevel(pred["risk_level"]),
        predicted_at_risk=pred["predicted_at_risk"],
        top_risk_factors=pred["top_risk_factors"],
        alert_conditions=conditions,
        model_version=pred.get("model_version"),
    )
    db.add(db_pred)
    create_and_fire_alert(db, student, pred, trigger_reason=trigger)
    return pred


# ── Student/Parent: view own record ──────────────────────────────────────────
@router.get("/my-profile", response_model=StudentOut)
def my_profile(payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    """Students and parents view their own/child's record."""
    role = payload.get("role")
    if role not in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Only students and parents can access this endpoint")
    student_db_id = payload.get("student_db_id")
    if not student_db_id:
        raise HTTPException(status_code=404, detail="No linked student record")
    student = db.query(Student).filter_by(id=student_db_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
    return _enrich(student, db)


# ── Individual Risk Analysis ──────────────────────────────────────────────────
@router.get("/{student_id}/risk-analysis")
def individual_risk_analysis(
    student_id: int,
    payload=Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """
    Deep individual risk analysis for a student.
    Returns: risk score, level, all triggered conditions, SHAP factors,
             trend over last 5 predictions, actionable recommendations.
    """
    role = payload.get("role")

    # Students/parents can only see their own
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        sid = payload.get("student_db_id")
        if sid != student_id:
            raise HTTPException(status_code=403, detail="Access denied")

    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Dept guard for faculty/HOD
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        if student.department_id != payload.get("dept_id"):
            raise HTTPException(status_code=403, detail="Not your department")

    # Latest prediction
    preds = (db.query(Prediction).filter_by(student_id=student_id)
               .order_by(desc(Prediction.created_at)).limit(5).all())
    latest = preds[0] if preds else None

    # Re-run live prediction
    dept_code = student.department.code if student.department else "CS"
    live_pred = predict_single({
        "department": dept_code, "semester": student.semester,
        "attendance_pct": student.attendance_pct,
        "internal_marks": student.internal_marks,
        "assignment_submission_rate": student.assignment_submission_rate,
        "prev_semester_cgpa": student.prev_semester_cgpa,
        "lab_attendance_pct": student.lab_attendance_pct,
        "quiz_avg_score": student.quiz_avg_score,
        "library_visits_per_month": student.library_visits_per_month,
        "extracurricular_participation": int(student.extracurricular_participation),
        "active_backlogs": student.active_backlogs,
    })

    conditions = evaluate_alert_conditions(student)
    if live_pred["risk_probability"] >= 0.55:
        conditions.append("high_risk_score")
    conditions = list(set(conditions))

    # Build recommendations
    recommendations = []
    if student.attendance_pct < 75:
        recommendations.append({
            "priority": "HIGH",
            "issue": "Low Attendance",
            "value": f"{student.attendance_pct:.1f}%",
            "target": "≥ 75%",
            "action": "Attend all remaining classes. Contact class teacher if personal issues exist.",
        })
    if student.internal_marks < 40:
        recommendations.append({
            "priority": "HIGH",
            "issue": "Poor Internal Marks",
            "value": f"{student.internal_marks:.1f}/100",
            "target": "≥ 40",
            "action": "Schedule extra tutoring sessions. Review previous exam papers.",
        })
    if student.assignment_submission_rate < 60:
        recommendations.append({
            "priority": "MEDIUM",
            "issue": "Low Assignment Submission",
            "value": f"{student.assignment_submission_rate:.1f}%",
            "target": "≥ 80%",
            "action": "Submit all pending assignments. Form a study group for accountability.",
        })
    if student.active_backlogs >= 2:
        recommendations.append({
            "priority": "HIGH",
            "issue": "Active Backlogs",
            "value": str(student.active_backlogs),
            "target": "0",
            "action": "Register for supplementary exams. Prioritize clearing backlogs this semester.",
        })
    if student.prev_semester_cgpa < 5.0 and student.prev_semester_cgpa > 0:
        recommendations.append({
            "priority": "MEDIUM",
            "issue": "Low CGPA",
            "value": f"{student.prev_semester_cgpa:.2f}",
            "target": "≥ 6.0",
            "action": "Attend academic counseling. Create a structured study plan.",
        })
    if student.quiz_avg_score < 40:
        recommendations.append({
            "priority": "MEDIUM",
            "issue": "Low Quiz Scores",
            "value": f"{student.quiz_avg_score:.1f}/100",
            "target": "≥ 50",
            "action": "Revise fundamentals. Practice daily quizzes and past papers.",
        })

    # Trend data
    trend = []
    for p in reversed(preds):
        trend.append({
            "date": p.created_at.strftime("%d %b"),
            "risk_probability": round(p.risk_probability * 100, 1),
            "risk_level": p.risk_level.value,
        })

    dept = student.department
    return {
        "student": {
            "id": student.id,
            "usn": student.usn or student.student_id,
            "full_name": student.full_name,
            "department": dept.code if dept else None,
            "department_name": dept.name if dept else None,
            "semester": student.semester,
            "section": student.section,
            "batch_year": student.batch_year,
        },
        "academic_metrics": {
            "attendance_pct":             student.attendance_pct,
            "internal_marks":             student.internal_marks,
            "assignment_submission_rate": student.assignment_submission_rate,
            "prev_semester_cgpa":         student.prev_semester_cgpa,
            "lab_attendance_pct":         student.lab_attendance_pct,
            "quiz_avg_score":             student.quiz_avg_score,
            "library_visits_per_month":   student.library_visits_per_month,
            "extracurricular_participation": student.extracurricular_participation,
            "active_backlogs":            student.active_backlogs,
        },
        "risk_analysis": {
            "risk_probability":  round(live_pred["risk_probability"] * 100, 2),
            "risk_level":        live_pred["risk_level"],
            "predicted_at_risk": live_pred["predicted_at_risk"],
            "alert_conditions":  [{"code": c, "label": CONDITION_LABELS.get(c, c)} for c in conditions],
            "top_risk_factors":  live_pred.get("top_risk_factors", []),
        },
        "recommendations": recommendations,
        "prediction_trend": trend,
        "summary": (
            f"{student.full_name} is at {live_pred['risk_level']} risk with a "
            f"{live_pred['risk_probability']*100:.1f}% probability score. "
            f"{'Immediate intervention required.' if live_pred['risk_level'] in ('High','Critical') else 'Monitor closely.'}"
        ),
    }


# ── List students ─────────────────────────────────────────────────────────────
@router.get("", response_model=List[StudentOut])
def list_students(
    dept_id:    Optional[int] = None,
    semester:   Optional[int] = None,
    section:    Optional[str] = None,
    risk_level: Optional[str] = None,
    search:     Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    payload=Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    role = payload.get("role")
    # Students/parents redirect to their own profile
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Use /students/my-profile")

    q = db.query(Student).filter_by(is_active=True)
    q = _dept_filter(q, payload)
    if dept_id:    q = q.filter(Student.department_id == dept_id)
    if semester:   q = q.filter(Student.semester == semester)
    if section:    q = q.filter(Student.section == section.upper())
    if search:
        s = f"%{search}%"
        q = q.filter(Student.student_id.ilike(s) | Student.full_name.ilike(s) | Student.usn.ilike(s))

    students = q.offset(skip).limit(limit).all()

    if risk_level:
        result = []
        for s in students:
            lp = (db.query(Prediction).filter_by(student_id=s.id)
                    .order_by(desc(Prediction.created_at)).first())
            if lp and lp.risk_level.value == risk_level:
                result.append(s)
        students = result

    return [_enrich(s, db) for s in students]


@router.post("", response_model=StudentOut, status_code=201)
def create_student(body: StudentCreate, payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Access denied")
    if role == UserRole.FACULTY.value and body.department_id != payload.get("dept_id"):
        raise HTTPException(status_code=403, detail="Can only add to your department")
    if db.query(Student).filter_by(student_id=body.student_id).first():
        raise HTTPException(status_code=409, detail="Student ID already exists")
    dept = db.query(Department).filter_by(id=body.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Auto-generate USN if not provided
    usn = body.usn or _generate_usn(dept.code, body.semester, db)
    if db.query(Student).filter_by(usn=usn).first():
        usn = _generate_usn(dept.code, body.semester, db)

    data = body.model_dump()
    data["usn"] = usn
    student = Student(**data)
    db.add(student)
    db.flush()
    pred = _predict_and_save(student, db, "create")
    db.add(AuditLog(user_id=int(payload["sub"]), action="create_student",
                    resource_id=student.student_id,
                    details={"risk_level": pred["risk_level"]}))
    db.commit()
    db.refresh(student)
    return _enrich(student, db)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        if payload.get("student_db_id") != student_id:
            raise HTTPException(status_code=403, detail="Access denied")
    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if role in (UserRole.FACULTY.value, UserRole.HOD.value):
        if student.department_id != payload.get("dept_id"):
            raise HTTPException(status_code=403, detail="Not your department")
    return _enrich(student, db)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, body: StudentUpdate,
                   payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Read-only access")
    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if role == UserRole.FACULTY.value and student.department_id != payload.get("dept_id"):
        raise HTTPException(status_code=403, detail="Not your department")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(student, field, val)
    pred = _predict_and_save(student, db, "update")
    db.add(AuditLog(user_id=int(payload["sub"]), action="update_student",
                    resource_id=student.student_id))
    db.commit()
    db.refresh(student)
    return _enrich(student, db)


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: int, payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value, UserRole.FACULTY.value):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_active = False
    db.add(AuditLog(user_id=int(payload["sub"]), action="delete_student",
                    resource_id=student.student_id))
    db.commit()


@router.get("/{student_id}/predictions")
def get_predictions(student_id: int, limit: int = 10,
                    payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        if payload.get("student_db_id") != student_id:
            raise HTTPException(status_code=403, detail="Access denied")
    preds = (db.query(Prediction).filter_by(student_id=student_id)
               .order_by(desc(Prediction.created_at)).limit(limit).all())
    return [{
        "id": p.id, "risk_probability": p.risk_probability,
        "risk_level": p.risk_level.value, "predicted_at_risk": p.predicted_at_risk,
        "top_risk_factors": p.top_risk_factors, "alert_conditions": p.alert_conditions,
        "model_version": p.model_version, "created_at": p.created_at.isoformat(),
    } for p in preds]


@router.post("/bulk/upload")
async def bulk_upload(
    file: UploadFile = File(...),
    dept_id: Optional[int] = None,
    payload=Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    role = payload.get("role")
    if role in (UserRole.STUDENT.value, UserRole.PARENT.value):
        raise HTTPException(status_code=403, detail="Access denied")
    if role == UserRole.FACULTY.value:
        dept_id = payload.get("dept_id")
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files accepted")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV")

    required = ["full_name", "semester", "attendance_pct", "internal_marks",
                "assignment_submission_rate", "prev_semester_cgpa"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

    depts   = {d.id: d for d in db.query(Department).all()}
    by_code = {d.code: d for d in depts.values()}
    created = updated = 0
    errors  = []
    batch   = []

    for _, row in df.iterrows():
        try:
            # Resolve dept
            if dept_id:
                d_id = dept_id
                dept = depts.get(d_id)
            elif "department" in df.columns:
                dept = by_code.get(str(row.get("department","CS")).strip().upper())
                d_id = dept.id if dept else list(depts.keys())[0]
                dept = depts.get(d_id)
            else:
                d_id  = list(depts.keys())[0]
                dept  = depts.get(d_id)

            # Determine USN
            sid = str(row.get("student_id", "")).strip()
            usn = str(row.get("usn", "")).strip().upper() or None
            if not sid and not usn:
                usn = _generate_usn(dept.code if dept else "CS", int(row.get("semester", 1)), db)
                sid = usn
            elif not sid:
                sid = usn

            existing = db.query(Student).filter(
                (Student.student_id == sid) | (Student.usn == usn)
            ).first() if (sid or usn) else None

            def _float(val, default=0.0): return float(val) if pd.notna(val) else default
            def _int(val, default=0):     return int(val)   if pd.notna(val) else default
            def _bool(val):               return bool(int(val)) if pd.notna(val) else False

            if existing:
                existing.attendance_pct             = _float(row.get("attendance_pct"))
                existing.internal_marks             = _float(row.get("internal_marks"))
                existing.assignment_submission_rate = _float(row.get("assignment_submission_rate"))
                existing.prev_semester_cgpa         = _float(row.get("prev_semester_cgpa"))
                existing.lab_attendance_pct         = _float(row.get("lab_attendance_pct"))
                existing.quiz_avg_score             = _float(row.get("quiz_avg_score"))
                existing.library_visits_per_month   = _int(row.get("library_visits_per_month"))
                existing.active_backlogs            = _int(row.get("active_backlogs"))
                if pd.notna(row.get("parent_email")):
                    existing.parent_email = str(row["parent_email"])
                batch.append(existing); updated += 1
            else:
                if not usn and dept:
                    usn = _generate_usn(dept.code, int(row.get("semester", 1)), db)
                s = Student(
                    student_id=sid or usn, usn=usn,
                    full_name=str(row["full_name"]).strip(),
                    department_id=d_id, semester=_int(row["semester"], 1),
                    section=str(row.get("section", "A")).upper(),
                    email=str(row["email"]) if pd.notna(row.get("email")) else None,
                    parent_email=str(row["parent_email"]) if pd.notna(row.get("parent_email")) else None,
                    batch_year=int(2000 + SEM_TO_BATCH.get(_int(row.get("semester"), 1), 22)),
                    attendance_pct=_float(row.get("attendance_pct")),
                    internal_marks=_float(row.get("internal_marks")),
                    assignment_submission_rate=_float(row.get("assignment_submission_rate")),
                    prev_semester_cgpa=_float(row.get("prev_semester_cgpa")),
                    lab_attendance_pct=_float(row.get("lab_attendance_pct")),
                    quiz_avg_score=_float(row.get("quiz_avg_score")),
                    library_visits_per_month=_int(row.get("library_visits_per_month")),
                    extracurricular_participation=_bool(row.get("extracurricular_participation")),
                    active_backlogs=_int(row.get("active_backlogs")),
                )
                db.add(s)
                try:
                    db.flush(); batch.append(s); created += 1
                except Exception:
                    db.rollback(); errors.append({"row": sid, "error": "Duplicate"}); continue
        except Exception as e:
            errors.append({"row": str(row.get("student_id", "?")), "error": str(e)})

    # Batch predict
    try:
        dept_map = {d.id: d.code for d in depts.values()}
        preds = predict_students([{
            "department": dept_map.get(s.department_id, "CS"), "semester": s.semester,
            "attendance_pct": s.attendance_pct, "internal_marks": s.internal_marks,
            "assignment_submission_rate": s.assignment_submission_rate,
            "prev_semester_cgpa": s.prev_semester_cgpa,
            "lab_attendance_pct": s.lab_attendance_pct,
            "quiz_avg_score": s.quiz_avg_score,
            "library_visits_per_month": s.library_visits_per_month,
            "extracurricular_participation": int(s.extracurricular_participation),
            "active_backlogs": s.active_backlogs,
        } for s in batch])
        from ..services.alert_service import evaluate_alert_conditions
        for s, p in zip(batch, preds):
            conds = evaluate_alert_conditions(s)
            if p["risk_probability"] >= 0.55: conds.append("high_risk_score")
            db.add(Prediction(
                student_id=s.id, risk_probability=p["risk_probability"],
                risk_level=RiskLevel(p["risk_level"]), predicted_at_risk=p["predicted_at_risk"],
                top_risk_factors=p["top_risk_factors"], alert_conditions=list(set(conds)),
                model_version=p.get("model_version"),
            ))
            create_and_fire_alert(db, s, p, trigger_reason="csv_upload")
    except Exception as e:
        logger.error(f"Batch predict failed: {e}")

    db.add(AuditLog(user_id=int(payload["sub"]), action="bulk_upload",
                    details={"created": created, "updated": updated}))
    db.commit()
    return {"success": True, "created": created, "updated": updated,
            "total_processed": created + updated, "errors": errors[:20]}
