"""Pydantic schemas — EduGuard v2.1"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRoleSchema(str, Enum):
    SUPER_ADMIN = "super_admin"
    HOD         = "hod"
    FACULTY     = "faculty"
    STUDENT     = "student"
    PARENT      = "parent"


class RiskLevelSchema(str, Enum):
    LOW      = "Low"
    MEDIUM   = "Medium"
    HIGH     = "High"
    CRITICAL = "Critical"


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)


class StudentLoginRequest(BaseModel):
    """Used for both student and parent login."""
    full_name: str = Field(min_length=2, description="Student's full name")
    usn: str       = Field(min_length=6, description="USN e.g. 4SN22CS001")


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: UserRoleSchema
    department_id: Optional[int] = None
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    linked_student_id: Optional[int] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    expires_in: int


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


# ── User ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    username: str      = Field(min_length=3, max_length=50)
    full_name: str     = Field(min_length=2, max_length=200)
    password: str      = Field(min_length=8)
    role: UserRoleSchema
    department_id: Optional[int] = None
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    full_name:     Optional[str] = None
    phone:         Optional[str] = None
    department_id: Optional[int] = None
    is_active:     Optional[bool] = None


# ── Department ────────────────────────────────────────────────────────────────
class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    student_count: Optional[int] = 0
    at_risk_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Student ───────────────────────────────────────────────────────────────────
class StudentCreate(BaseModel):
    student_id:   str   = Field(min_length=3, max_length=30)
    usn:          Optional[str] = None         # auto-generated if blank
    full_name:    str   = Field(min_length=2, max_length=200)
    email:        Optional[EmailStr] = None
    phone:        Optional[str] = None
    parent_email: Optional[EmailStr] = None
    parent_phone: Optional[str] = None
    department_id: int
    semester:     int   = Field(ge=1, le=8)
    section:      str   = Field(default="A", max_length=5)
    batch_year:   Optional[int] = None
    attendance_pct:             float = Field(ge=0, le=100, default=0.0)
    internal_marks:             float = Field(ge=0, le=100, default=0.0)
    assignment_submission_rate: float = Field(ge=0, le=100, default=0.0)
    prev_semester_cgpa:         float = Field(ge=0, le=10,  default=0.0)
    lab_attendance_pct:         float = Field(ge=0, le=100, default=0.0)
    quiz_avg_score:             float = Field(ge=0, le=100, default=0.0)
    library_visits_per_month:   int   = Field(ge=0, le=30,  default=0)
    extracurricular_participation: bool = False
    active_backlogs:            int   = Field(ge=0, le=20,  default=0)
    assigned_faculty_id:        Optional[int] = None


class StudentUpdate(BaseModel):
    full_name:    Optional[str] = None
    email:        Optional[EmailStr] = None
    phone:        Optional[str] = None
    parent_email: Optional[EmailStr] = None
    parent_phone: Optional[str] = None
    semester:     Optional[int] = Field(None, ge=1, le=8)
    section:      Optional[str] = None
    attendance_pct:             Optional[float] = Field(None, ge=0, le=100)
    internal_marks:             Optional[float] = Field(None, ge=0, le=100)
    assignment_submission_rate: Optional[float] = Field(None, ge=0, le=100)
    prev_semester_cgpa:         Optional[float] = Field(None, ge=0, le=10)
    lab_attendance_pct:         Optional[float] = Field(None, ge=0, le=100)
    quiz_avg_score:             Optional[float] = Field(None, ge=0, le=100)
    library_visits_per_month:   Optional[int]   = Field(None, ge=0, le=30)
    extracurricular_participation: Optional[bool] = None
    active_backlogs:            Optional[int]   = Field(None, ge=0, le=20)
    assigned_faculty_id:        Optional[int]   = None


class StudentOut(BaseModel):
    id: int
    student_id: str
    usn: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    parent_email: Optional[str] = None
    department_id: int
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    semester: int
    section: str
    batch_year: Optional[int] = None
    attendance_pct: float
    internal_marks: float
    assignment_submission_rate: float
    prev_semester_cgpa: float
    lab_attendance_pct: float
    quiz_avg_score: float
    library_visits_per_month: int
    extracurricular_participation: bool
    active_backlogs: int
    assigned_faculty_id: Optional[int] = None
    latest_risk_level: Optional[str] = None
    latest_risk_probability: Optional[float] = None
    alert_conditions: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Prediction ────────────────────────────────────────────────────────────────
class PredictionOut(BaseModel):
    id: int
    student_id: int
    risk_probability: float
    risk_level: RiskLevelSchema
    predicted_at_risk: bool
    top_risk_factors: Optional[List[Dict[str, Any]]] = None
    alert_conditions: Optional[List[str]] = None
    model_version: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Alert ─────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_usn: Optional[str] = None
    department_code: Optional[str] = None
    risk_level: RiskLevelSchema
    risk_probability: float
    conditions: Optional[List[str]] = None
    message: Optional[str] = None
    status: str
    trigger_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Model Metrics ─────────────────────────────────────────────────────────────
class ModelMetricsOut(BaseModel):
    model_version: str
    f1_score: float
    auc_roc: float
    precision: float
    recall: float
    avg_precision: float
    threshold: float
    n_samples: int
    n_at_risk: int
    confusion_matrix: Optional[List[List[int]]] = None
    feature_importance: Optional[List[Dict[str, Any]]] = None
    trained_at: datetime

    class Config:
        from_attributes = True
