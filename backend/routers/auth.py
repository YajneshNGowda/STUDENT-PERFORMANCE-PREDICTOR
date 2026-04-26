"""
Auth routes: login (staff / student / parent), logout, password reset, me.
Student login:  username=full_name, password=USN
Parent login:   username=full_name, password=USN  (role differentiated by form)
Staff login:    email + password
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..models.connection import get_db
from ..models.database import User, UserRole, Student, AuditLog
from ..models.schemas import (
    LoginRequest, StudentLoginRequest, LoginResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest,
)
from ..utils.security import (
    verify_password, hash_password, create_access_token,
    get_current_user_payload, create_reset_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, email=user.email, username=user.username,
        full_name=user.full_name, role=user.role,
        department_id=user.department_id,
        department_code=user.department.code if user.department else None,
        department_name=user.department.name if user.department else None,
        phone=user.phone, is_active=user.is_active,
        linked_student_id=user.linked_student_id,
        last_login=user.last_login, created_at=user.created_at,
    )


# ── Staff login (email + password) ────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
def staff_login(req: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    if user.role in (UserRole.STUDENT, UserRole.PARENT):
        raise HTTPException(status_code=400, detail="Use student/parent login endpoint")

    token = create_access_token({
        "sub": str(user.id), "email": user.email,
        "role": user.role.value, "dept_id": user.department_id,
    })
    user.last_login = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=user.id, action="login",
                    ip_address=req.client.host if req.client else None))
    db.commit()
    return LoginResponse(access_token=token, user=_user_out(user), expires_in=28800)


# ── Student login (name + USN) ────────────────────────────────────────────────
@router.post("/student-login", response_model=LoginResponse)
def student_login(req: Request, body: StudentLoginRequest, db: Session = Depends(get_db)):
    """
    Students log in with their full name (case-insensitive) and USN as password.
    """
    student = db.query(Student).filter(
        Student.usn == body.usn.strip().upper(),
        Student.is_active == True,
    ).first()
    if not student:
        raise HTTPException(status_code=401, detail="Invalid name or USN")
    if student.full_name.strip().lower() != body.full_name.strip().lower():
        raise HTTPException(status_code=401, detail="Invalid name or USN")

    # Find or auto-create the student portal user
    user = db.query(User).filter_by(
        linked_student_id=student.id, role=UserRole.STUDENT
    ).first()
    if not user:
        from ..utils.security import hash_password as hp
        user = User(
            email=student.email or f"{student.usn.lower()}@student.eduguard.edu",
            username=f"stu_{student.usn.lower()}",
            full_name=student.full_name,
            hashed_password=hp(student.usn),   # USN is the password
            role=UserRole.STUDENT,
            department_id=student.department_id,
            linked_student_id=student.id,
            is_active=True, is_verified=True,
        )
        db.add(user)
        db.flush()

    token = create_access_token({
        "sub": str(user.id), "role": UserRole.STUDENT.value,
        "student_db_id": student.id, "dept_id": student.department_id,
    })
    user.last_login = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=user.id, action="student_login",
                    ip_address=req.client.host if req.client else None))
    db.commit()
    return LoginResponse(access_token=token, user=_user_out(user), expires_in=28800)


# ── Parent login (student name + USN) ─────────────────────────────────────────
@router.post("/parent-login", response_model=LoginResponse)
def parent_login(req: Request, body: StudentLoginRequest, db: Session = Depends(get_db)):
    """
    Parents log in with their child's full name and USN.
    """
    student = db.query(Student).filter(
        Student.usn == body.usn.strip().upper(),
        Student.is_active == True,
    ).first()
    if not student:
        raise HTTPException(status_code=401, detail="Invalid student name or USN")
    if student.full_name.strip().lower() != body.full_name.strip().lower():
        raise HTTPException(status_code=401, detail="Invalid student name or USN")

    user = db.query(User).filter_by(
        linked_student_id=student.id, role=UserRole.PARENT
    ).first()
    if not user:
        from ..utils.security import hash_password as hp
        user = User(
            email=student.parent_email or f"parent.{student.usn.lower()}@parent.eduguard.edu",
            username=f"par_{student.usn.lower()}",
            full_name=f"Parent of {student.full_name}",
            hashed_password=hp(student.usn),
            role=UserRole.PARENT,
            department_id=student.department_id,
            linked_student_id=student.id,
            is_active=True, is_verified=True,
        )
        db.add(user)
        db.flush()

    token = create_access_token({
        "sub": str(user.id), "role": UserRole.PARENT.value,
        "student_db_id": student.id, "dept_id": student.department_id,
    })
    user.last_login = datetime.now(timezone.utc)
    db.add(AuditLog(user_id=user.id, action="parent_login",
                    ip_address=req.client.host if req.client else None))
    db.commit()
    return LoginResponse(access_token=token, user=_user_out(user), expires_in=28800)


# ── Common ─────────────────────────────────────────────────────────────────────
@router.post("/logout")
def logout(payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    db.add(AuditLog(user_id=int(payload["sub"]), action="logout"))
    db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
def get_me(payload=Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_out(user)


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if user:
        token, expiry = create_reset_token()
        user.reset_token = token
        user.reset_token_expiry = expiry
        db.commit()
        logger.info(f"🔑 Reset token for {user.email}: {token}")
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(reset_token=body.token).first()
    if not user or not user.reset_token_expiry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    from datetime import timezone as tz
    expiry = user.reset_token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=tz.utc)
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Token expired")
    user.hashed_password  = hash_password(body.new_password)
    user.reset_token      = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    payload=Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.add(AuditLog(user_id=user.id, action="change_password"))
    db.commit()
    return {"message": "Password changed successfully"}
