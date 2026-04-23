"""
Pydantic schemas for request validation and response serialization.
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────
class UserRoleSchema(str, Enum):
    SUPER_ADMIN = "super_admin"
    HOD = "hod"
    FACULTY = "faculty"


class RiskLevelSchema(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"
    expires_in: int


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @validator("new_password")
    def strong_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


# ── User ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8)
    role: UserRoleSchema
    department_id: Optional[int] = None
    phone: Optional[str] = None

    @validator("username")
    def username_alphanumeric(cls, v):
        if not v.replace("_", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores allowed)")
        return v.lower()


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: UserRoleSchema
    department_id: Optional[int]
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    phone: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Department ────────────────────────────────────────────────────────────────
class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    is_active: bool
    student_count: Optional[int] = 0
    at_risk_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Student ───────────────────────────────────────────────────────────────────
class StudentCreate(BaseModel):
    student_id: str = Field(min_length=3, max_length=20)
    full_name: str = Field(min_length=2, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department_id: int
    semester: int = Field(ge=1, le=8)
    section: str = Field(default="A", max_length=5)
    batch_year: Optional[int] = None
    attendance_pct: float = Field(ge=0, le=100, default=0.0)
    internal_marks: float = Field(ge=0, le=100, default=0.0)
    assignment_submission_rate: float = Field(ge=0, le=100, default=0.0)
    prev_semester_cgpa: float = Field(ge=0, le=10, default=0.0)
    lab_attendance_pct: float = Field(ge=0, le=100, default=0.0)
    quiz_avg_score: float = Field(ge=0, le=100, default=0.0)
    library_visits_per_month: int = Field(ge=0, le=30, default=0)
    extracurricular_participation: bool = False
    active_backlogs: int = Field(ge=0, le=20, default=0)
    assigned_faculty_id: Optional[int] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    semester: Optional[int] = Field(None, ge=1, le=8)
    section: Optional[str] = None
    attendance_pct: Optional[float] = Field(None, ge=0, le=100)
    internal_marks: Optional[float] = Field(None, ge=0, le=100)
    assignment_submission_rate: Optional[float] = Field(None, ge=0, le=100)
    prev_semester_cgpa: Optional[float] = Field(None, ge=0, le=10)
    lab_attendance_pct: Optional[float] = Field(None, ge=0, le=100)
    quiz_avg_score: Optional[float] = Field(None, ge=0, le=100)
    library_visits_per_month: Optional[int] = Field(None, ge=0, le=30)
    extracurricular_participation: Optional[bool] = None
    active_backlogs: Optional[int] = Field(None, ge=0, le=20)
    assigned_faculty_id: Optional[int] = None


class StudentOut(BaseModel):
    id: int
    student_id: str
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    department_id: int
    department_code: Optional[str] = None
    semester: int
    section: str
    batch_year: Optional[int]
    attendance_pct: float
    internal_marks: float
    assignment_submission_rate: float
    prev_semester_cgpa: float
    lab_attendance_pct: float
    quiz_avg_score: float
    library_visits_per_month: int
    extracurricular_participation: bool
    active_backlogs: int
    assigned_faculty_id: Optional[int]
    latest_risk_level: Optional[str] = None
    latest_risk_probability: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Prediction ────────────────────────────────────────────────────────────────
class PredictionOut(BaseModel):
    id: int
    student_id: int
    risk_probability: float
    risk_level: RiskLevelSchema
    predicted_at_risk: bool
    top_risk_factors: Optional[List[Dict[str, Any]]]
    model_version: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Alert ─────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    department_code: Optional[str] = None
    risk_level: RiskLevelSchema
    risk_probability: float
    message: Optional[str]
    status: str
    trigger_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────
class DashboardOverview(BaseModel):
    total_students: int
    at_risk_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    at_risk_pct: float
    total_alerts_today: int
    unacknowledged_alerts: int
    last_model_trained: Optional[datetime]
    model_f1: Optional[float]
    model_auc: Optional[float]
    departments: List[Dict[str, Any]]
    risk_trend: List[Dict[str, Any]]


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
    confusion_matrix: Optional[List[List[int]]]
    feature_importance: Optional[List[Dict[str, Any]]]
    trained_at: datetime

    class Config:
        from_attributes = True


LoginResponse.model_rebuild()
