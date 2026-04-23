"""
User management routes (admin only for create/delete, self for profile).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..models.connection import get_db
from ..models.database import User, UserRole, Department, AuditLog
from ..models.schemas import UserCreate, UserUpdate, UserOut
from ..utils.security import hash_password, get_current_user_payload

router = APIRouter(prefix="/api/users", tags=["Users"])


def _require_admin(payload=Depends(get_current_user_payload)):
    if payload.get("role") != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return payload


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, email=user.email, username=user.username,
        full_name=user.full_name, role=user.role,
        department_id=user.department_id,
        department_code=user.department.code if user.department else None,
        department_name=user.department.name if user.department else None,
        phone=user.phone, is_active=user.is_active,
        last_login=user.last_login, created_at=user.created_at,
    )


@router.get("", response_model=List[UserOut])
def list_users(
    role: Optional[str] = None,
    dept_id: Optional[int] = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    if payload["role"] not in (UserRole.SUPER_ADMIN.value, UserRole.HOD.value):
        raise HTTPException(status_code=403, detail="Access denied")

    q = db.query(User)
    if payload["role"] == UserRole.HOD.value:
        q = q.filter_by(department_id=payload.get("dept_id"))
    else:
        if dept_id:
            q = q.filter_by(department_id=dept_id)
    if role:
        q = q.filter_by(role=role)
    return [_user_out(u) for u in q.all()]


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(_require_admin),
):
    if db.query(User).filter_by(email=body.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter_by(username=body.username.lower()).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        email=body.email.lower(),
        username=body.username.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole(body.role.value),
        department_id=body.department_id,
        phone=body.phone,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.add(AuditLog(
        user_id=int(payload["sub"]), action="create_user",
        resource_type="user", details={"email": body.email},
    ))
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Users can view themselves; admins can view all
    if payload["role"] == UserRole.FACULTY.value and int(payload["sub"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _user_out(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Only admin or self
    if payload["role"] == UserRole.FACULTY.value and int(payload["sub"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(_require_admin),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if int(payload["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.add(AuditLog(
        user_id=int(payload["sub"]), action="delete_user",
        resource_type="user", resource_id=str(user_id),
    ))
    db.commit()
