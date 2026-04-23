"""
Student management routes: CRUD, CSV bulk import, predictions, risk flags.
Role-based visibility: faculty → own dept only, HOD → full dept, admin → all.
"""

import io
import logging
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from ..models.connection import get_db
from ..models.database import (
    Student, Department, User, Prediction, Alert,
    RiskLevel, AuditLog, UserRole
)
from ..models.schemas import StudentCreate, StudentUpdate, StudentOut
from ..utils.security import get_current_user_payload
from ..services.ml_service import predict_single, predict_students
from ..services.alert_service import create_and_fire_alert, fire_batch_alerts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/students", tags=["Students"])


# ── Access helpers ────────────────────────────────────────────────────────────
def _dept_filter(q, payload: dict, db: Session):
    """Apply department visibility filter based on role."""
    role = payload.get("role")
    if role == UserRole.FACULTY.value:
        dept_id = payload.get("dept_id")
        if dept_id:
            q = q.filter(Student.department_id == dept_id)
    elif role == UserRole.HOD.value:
        dept_id = payload.get("dept_id")
        if dept_id:
            q = q.filter(Student.department_id == dept_id)
    # super_admin sees all
    return q


def _enrich_student(student: Student, db: Session) -> StudentOut:
    dept_code = student.department.code if student.department else None
    latest_pred = (
        db.query(Prediction)
        .filter_by(student_id=student.id)
        .order_by(desc(Prediction.created_at))
        .first()
    )
    return StudentOut(
        id=student.id, student_id=student.student_id,
        full_name=student.full_name, email=student.email, phone=student.phone,
        department_id=student.department_id, department_code=dept_code,
        semester=student.semester, section=student.section, batch_year=student.batch_year,
        attendance_pct=student.attendance_pct, internal_marks=student.internal_marks,
        assignment_submission_rate=student.assignment_submission_rate,
        prev_semester_cgpa=student.prev_semester_cgpa,
        lab_attendance_pct=student.lab_attendance_pct,
        quiz_avg_score=student.quiz_avg_score,
        library_visits_per_month=student.library_visits_per_month,
        extracurricular_participation=student.extracurricular_participation,
        active_backlogs=student.active_backlogs,
        assigned_faculty_id=student.assigned_faculty_id,
        latest_risk_level=latest_pred.risk_level.value if latest_pred else None,
        latest_risk_probability=latest_pred.risk_probability if latest_pred else None,
        created_at=student.created_at,
        updated_at=student.updated_at,
    )


def _predict_and_save(student: Student, db: Session, trigger: str):
    """Run prediction for one student, save to DB, fire alerts."""
    dept_code = student.department.code if student.department else "CSE"
    pred = predict_single({
        "department": dept_code, "semester": student.semester,
        "attendance_pct": student.attendance_pct, "internal_marks": student.internal_marks,
        "assignment_submission_rate": student.assignment_submission_rate,
        "prev_semester_cgpa": student.prev_semester_cgpa,
        "lab_attendance_pct": student.lab_attendance_pct,
        "quiz_avg_score": student.quiz_avg_score,
        "library_visits_per_month": student.library_visits_per_month,
        "extracurricular_participation": int(student.extracurricular_participation),
        "active_backlogs": student.active_backlogs,
    })
    db_pred = Prediction(
        student_id=student.id,
        risk_probability=pred["risk_probability"],
        risk_level=RiskLevel(pred["risk_level"]),
        predicted_at_risk=pred["predicted_at_risk"],
        top_risk_factors=pred["top_risk_factors"],
        model_version=pred.get("model_version"),
    )
    db.add(db_pred)
    create_and_fire_alert(db, student, pred, trigger_reason=trigger)
    return pred


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[StudentOut])
def list_students(
    dept_id: Optional[int] = None,
    semester: Optional[int] = None,
    section: Optional[str] = None,
    risk_level: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    q = db.query(Student).filter_by(is_active=True)
    q = _dept_filter(q, payload, db)

    if dept_id:
        q = q.filter(Student.department_id == dept_id)
    if semester:
        q = q.filter(Student.semester == semester)
    if section:
        q = q.filter(Student.section == section.upper())
    if search:
        s = f"%{search}%"
        q = q.filter(
            Student.student_id.ilike(s) |
            Student.full_name.ilike(s)
        )

    students = q.offset(skip).limit(limit).all()

    if risk_level:
        # Filter by latest prediction risk level
        result = []
        for s in students:
            lp = db.query(Prediction).filter_by(student_id=s.id).order_by(desc(Prediction.created_at)).first()
            if lp and lp.risk_level.value == risk_level:
                result.append(s)
        students = result

    return [_enrich_student(s, db) for s in students]


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    body: StudentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    # Role check: faculty can only create in their dept
    role = payload.get("role")
    if role == UserRole.FACULTY.value:
        if body.department_id != payload.get("dept_id"):
            raise HTTPException(status_code=403, detail="You can only add students to your department")

    if db.query(Student).filter_by(student_id=body.student_id).first():
        raise HTTPException(status_code=409, detail="Student ID already exists")

    dept = db.query(Department).filter_by(id=body.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    student = Student(**body.model_dump())
    db.add(student)
    db.flush()

    pred = _predict_and_save(student, db, trigger="create")
    db.add(AuditLog(
        user_id=int(payload["sub"]), action="create_student",
        resource_type="student", resource_id=student.student_id,
        details={"risk_level": pred["risk_level"]},
    ))
    db.commit()
    db.refresh(student)
    return _enrich_student(student, db)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    role = payload.get("role")
    if role == UserRole.FACULTY.value and student.department_id != payload.get("dept_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    return _enrich_student(student, db)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    body: StudentUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    role = payload.get("role")
    if role == UserRole.FACULTY.value and student.department_id != payload.get("dept_id"):
        raise HTTPException(status_code=403, detail="Access denied: not your department")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(student, field, val)

    pred = _predict_and_save(student, db, trigger="update")
    db.add(AuditLog(
        user_id=int(payload["sub"]), action="update_student",
        resource_type="student", resource_id=student.student_id,
        details={"fields_updated": list(body.model_dump(exclude_none=True).keys()),
                 "new_risk_level": pred["risk_level"]},
    ))
    db.commit()
    db.refresh(student)
    return _enrich_student(student, db)


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    role = payload.get("role")
    if role == UserRole.FACULTY.value and student.department_id != payload.get("dept_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    student.is_active = False  # soft delete
    db.add(AuditLog(
        user_id=int(payload["sub"]), action="delete_student",
        resource_type="student", resource_id=student.student_id,
    ))
    db.commit()


@router.get("/{student_id}/predictions")
def get_student_predictions(
    student_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    student = db.query(Student).filter_by(id=student_id, is_active=True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    preds = (
        db.query(Prediction).filter_by(student_id=student_id)
        .order_by(desc(Prediction.created_at)).limit(limit).all()
    )
    return [
        {
            "id": p.id,
            "risk_probability": p.risk_probability,
            "risk_level": p.risk_level.value,
            "predicted_at_risk": p.predicted_at_risk,
            "top_risk_factors": p.top_risk_factors,
            "model_version": p.model_version,
            "created_at": p.created_at.isoformat(),
        } for p in preds
    ]


@router.post("/bulk/upload")
async def bulk_upload_csv(
    file: UploadFile = File(...),
    dept_id: Optional[int] = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files accepted")

    role = payload.get("role")
    if role == UserRole.FACULTY.value:
        dept_id = payload.get("dept_id")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV file")

    required = ["student_id", "full_name", "semester", "attendance_pct",
                "internal_marks", "assignment_submission_rate", "prev_semester_cgpa"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

    # Fill defaults
    defaults = {
        "lab_attendance_pct": 0.0, "quiz_avg_score": 0.0,
        "library_visits_per_month": 0, "extracurricular_participation": False,
        "active_backlogs": 0, "section": "A", "email": None, "phone": None,
    }
    for col, val in defaults.items():
        if col not in df.columns:
            df[col] = val

    created, updated, errors = 0, 0, []

    departments = {d.id: d for d in db.query(Department).all()}
    dept_by_code = {d.code: d for d in departments.values()}

    students_batch = []
    for _, row in df.iterrows():
        try:
            # Resolve department
            sid = str(row["student_id"]).strip()
            if dept_id:
                d_id = dept_id
            elif "department" in df.columns:
                dept_code = str(row.get("department", "CSE")).strip().upper()
                dept_obj = dept_by_code.get(dept_code)
                d_id = dept_obj.id if dept_obj else list(departments.keys())[0]
            else:
                d_id = list(departments.keys())[0]

            existing = db.query(Student).filter_by(student_id=sid).first()
            if existing:
                existing.internal_marks = float(row.get("internal_marks", 0))
                existing.attendance_pct = float(row.get("attendance_pct", 0))
                existing.assignment_submission_rate = float(row.get("assignment_submission_rate", 0))
                existing.prev_semester_cgpa = float(row.get("prev_semester_cgpa", 0))
                existing.lab_attendance_pct = float(row.get("lab_attendance_pct", 0))
                existing.quiz_avg_score = float(row.get("quiz_avg_score", 0))
                existing.library_visits_per_month = int(row.get("library_visits_per_month", 0))
                existing.active_backlogs = int(row.get("active_backlogs", 0))
                students_batch.append(existing)
                updated += 1
            else:
                s = Student(
                    student_id=sid, full_name=str(row["full_name"]).strip(),
                    department_id=d_id, semester=int(row["semester"]),
                    section=str(row.get("section", "A")).upper(),
                    email=row.get("email") if pd.notna(row.get("email")) else None,
                    phone=row.get("phone") if pd.notna(row.get("phone")) else None,
                    attendance_pct=float(row.get("attendance_pct", 0)),
                    internal_marks=float(row.get("internal_marks", 0)),
                    assignment_submission_rate=float(row.get("assignment_submission_rate", 0)),
                    prev_semester_cgpa=float(row.get("prev_semester_cgpa", 0)),
                    lab_attendance_pct=float(row.get("lab_attendance_pct", 0)),
                    quiz_avg_score=float(row.get("quiz_avg_score", 0)),
                    library_visits_per_month=int(row.get("library_visits_per_month", 0)),
                    extracurricular_participation=bool(row.get("extracurricular_participation", False)),
                    active_backlogs=int(row.get("active_backlogs", 0)),
                )
                db.add(s)
                students_batch.append(s)
                created += 1
        except Exception as e:
            errors.append({"row": str(row.get("student_id", "?")), "error": str(e)})

    db.flush()

    # Batch predict and alert
    try:
        dept_map = {d.id: d.code for d in departments.values()}
        student_dicts = [{
            "department": dept_map.get(s.department_id, "CSE"),
            "semester": s.semester,
            "attendance_pct": s.attendance_pct, "internal_marks": s.internal_marks,
            "assignment_submission_rate": s.assignment_submission_rate,
            "prev_semester_cgpa": s.prev_semester_cgpa,
            "lab_attendance_pct": s.lab_attendance_pct,
            "quiz_avg_score": s.quiz_avg_score,
            "library_visits_per_month": s.library_visits_per_month,
            "extracurricular_participation": int(s.extracurricular_participation),
            "active_backlogs": s.active_backlogs,
        } for s in students_batch]
        predictions = predict_students(student_dicts)
        for s, p in zip(students_batch, predictions):
            db.add(Prediction(
                student_id=s.id, risk_probability=p["risk_probability"],
                risk_level=RiskLevel(p["risk_level"]), predicted_at_risk=p["predicted_at_risk"],
                top_risk_factors=p["top_risk_factors"], model_version=p.get("model_version"),
            ))
            create_and_fire_alert(db, s, p, trigger_reason="csv_upload")
    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")

    db.add(AuditLog(
        user_id=int(payload["sub"]), action="bulk_upload",
        details={"file": file.filename, "created": created, "updated": updated, "errors": len(errors)},
    ))
    db.commit()

    return {
        "success": True,
        "created": created, "updated": updated,
        "total_processed": created + updated,
        "errors": errors[:20],
    }
