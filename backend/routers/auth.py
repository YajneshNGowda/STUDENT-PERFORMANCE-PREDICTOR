"""
Authentication routes: login, refresh, forgot/reset password, me endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..models.connection import get_db
from ..models.database import User, UserRole, AuditLog
from ..models.schemas import (
    LoginRequest, LoginResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest,
    UserCreate
)
from ..utils.security import (
    verify_password, hash_password, create_access_token,
    get_current_user_payload, create_reset_token
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _get_user_out(user: User, db: Session) -> UserOut:
    dept_code = None
    dept_name = None
    if user.department:
        dept_code = user.department.code
        dept_name = user.department.name
    return UserOut(
        id=user.id, email=user.email, username=user.username,
        full_name=user.full_name, role=user.role,
        department_id=user.department_id,
        department_code=dept_code, department_name=dept_name,
        phone=user.phone, is_active=user.is_active,
        last_login=user.last_login, created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "dept_id": user.department_id,
    })

    # Update last login
    user.last_login = datetime.now(timezone.utc)

    # Audit log
    db.add(AuditLog(
        user_id=user.id, action="login",
        ip_address=request.client.host if request.client else None,
    ))
    db.commit()

    return LoginResponse(
        access_token=token,
        user=_get_user_out(user, db),
        expires_in=60 * 8 * 60,  # seconds
    )


@router.post("/logout")
def logout(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    db.add(AuditLog(user_id=int(payload["sub"]), action="logout"))
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def get_me(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _get_user_out(user, db)


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    # Always return 200 to prevent email enumeration
    if user:
        token, expiry = create_reset_token()
        user.reset_token = token
        user.reset_token_expiry = expiry
        db.commit()
        # In production, send email with token
        # send_reset_email(user.email, token)
        import logging
        logging.getLogger(__name__).info(
            f"🔑 Password reset token for {user.email}: {token}"
        )
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(reset_token=body.token).first()
    if not user or not user.reset_token_expiry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    now = datetime.now(timezone.utc)
    expiry = user.reset_token_expiry
    if expiry.tzinfo is None:
        from datetime import timezone as tz
        expiry = expiry.replace(tzinfo=tz.utc)

    if now > expiry:
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user.hashed_password = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.add(AuditLog(user_id=user.id, action="change_password"))
    db.commit()
    return {"message": "Password changed successfully"}
