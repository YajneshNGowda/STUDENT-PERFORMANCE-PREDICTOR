"""
SQLAlchemy database models — EduGuard SaaS v2.1
Roles: super_admin, hod, faculty, student, parent
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, JSON, Index
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    HOD         = "hod"
    FACULTY     = "faculty"
    STUDENT     = "student"
    PARENT      = "parent"


class RiskLevel(str, enum.Enum):
    LOW      = "Low"
    MEDIUM   = "Medium"
    HIGH     = "High"
    CRITICAL = "Critical"


class AlertStatus(str, enum.Enum):
    PENDING      = "pending"
    SENT         = "sent"
    FAILED       = "failed"
    ACKNOWLEDGED = "acknowledged"


class AlertCondition(str, enum.Enum):
    LOW_ATTENDANCE      = "low_attendance"
    POOR_MARKS          = "poor_marks"
    CONSECUTIVE_FAILURE = "consecutive_failure"
    PERFORMANCE_DROP    = "performance_drop"
    HIGH_RISK_SCORE     = "high_risk_score"
    MULTIPLE_BACKLOGS   = "multiple_backlogs"


# ── Department ────────────────────────────────────────────────────────────────
class Department(Base):
    __tablename__ = "departments"

    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(20), unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    users    = relationship("User",    back_populates="department")
    students = relationship("Student", back_populates="department")


# ── User ──────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    username         = Column(String(100), unique=True, nullable=False)
    full_name        = Column(String(200), nullable=False)
    hashed_password  = Column(String(255), nullable=False)
    role             = Column(SAEnum(UserRole), nullable=False)
    department_id    = Column(Integer, ForeignKey("departments.id"), nullable=True)
    phone            = Column(String(20), nullable=True)
    # For student/parent roles: link to student record
    linked_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    is_active        = Column(Boolean, default=True)
    is_verified      = Column(Boolean, default=False)
    reset_token      = Column(String(255), nullable=True)
    reset_token_expiry = Column(DateTime(timezone=True), nullable=True)
    last_login       = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    department     = relationship("Department", back_populates="users")
    linked_student = relationship("Student", foreign_keys=[linked_student_id], back_populates="portal_users")
    audit_logs     = relationship("AuditLog", back_populates="user")

    __table_args__ = (Index("idx_user_email_role", "email", "role"),)


# ── Student ───────────────────────────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(String(30), unique=True, nullable=False, index=True)  # USN: 4SN22CS001
    full_name   = Column(String(200), nullable=False)
    email       = Column(String(255), nullable=True)
    phone       = Column(String(20), nullable=True)
    parent_email = Column(String(255), nullable=True)   # for auto alerts
    parent_phone = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester    = Column(Integer, nullable=False)
    section     = Column(String(10), nullable=True, default="A")
    batch_year  = Column(Integer, nullable=True)        # e.g. 2022
    usn         = Column(String(30), unique=True, nullable=True, index=True)  # formatted USN

    # Academic performance
    attendance_pct             = Column(Float, default=0.0)
    internal_marks             = Column(Float, default=0.0)
    assignment_submission_rate = Column(Float, default=0.0)
    prev_semester_cgpa         = Column(Float, default=0.0)
    lab_attendance_pct         = Column(Float, default=0.0)
    quiz_avg_score             = Column(Float, default=0.0)
    library_visits_per_month   = Column(Integer, default=0)
    extracurricular_participation = Column(Boolean, default=False)
    active_backlogs            = Column(Integer, default=0)

    assigned_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    department   = relationship("Department", back_populates="students")
    portal_users = relationship("User", foreign_keys="User.linked_student_id", back_populates="linked_student")
    predictions  = relationship("Prediction", back_populates="student", cascade="all, delete-orphan")
    alerts       = relationship("Alert",      back_populates="student", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_student_dept_sem",  "department_id", "semester"),
        Index("idx_student_faculty",   "assigned_faculty_id"),
        Index("idx_student_usn",       "usn"),
    )


# ── Prediction ────────────────────────────────────────────────────────────────
class Prediction(Base):
    __tablename__ = "predictions"

    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, ForeignKey("students.id"), nullable=False)
    risk_probability = Column(Float, nullable=False)
    risk_level       = Column(SAEnum(RiskLevel), nullable=False)
    predicted_at_risk = Column(Boolean, nullable=False)
    shap_values      = Column(JSON, nullable=True)
    top_risk_factors = Column(JSON, nullable=True)
    alert_conditions = Column(JSON, nullable=True)  # list of triggered alert conditions
    model_version    = Column(String(50), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="predictions")

    __table_args__ = (Index("idx_pred_student_created", "student_id", "created_at"),)


# ── Alert ─────────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"

    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, ForeignKey("students.id"), nullable=False)
    risk_level       = Column(SAEnum(RiskLevel), nullable=False)
    risk_probability = Column(Float, nullable=False)
    conditions       = Column(JSON, nullable=True)    # triggered alert conditions
    message          = Column(Text, nullable=True)
    status           = Column(SAEnum(AlertStatus), default=AlertStatus.PENDING)
    sent_to_faculty_email = Column(String(255), nullable=True)
    sent_to_parent_email  = Column(String(255), nullable=True)
    trigger_reason   = Column(String(100), nullable=True)
    acknowledged_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at  = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="alerts")

    __table_args__ = (Index("idx_alert_status_created", "status", "created_at"),)


# ── Model Metrics ─────────────────────────────────────────────────────────────
class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id               = Column(Integer, primary_key=True, index=True)
    model_version    = Column(String(50), nullable=False)
    f1_score         = Column(Float, nullable=False)
    auc_roc          = Column(Float, nullable=False)
    precision        = Column(Float, nullable=False)
    recall           = Column(Float, nullable=False)
    avg_precision    = Column(Float, nullable=False)
    threshold        = Column(Float, nullable=False)
    n_samples        = Column(Integer, nullable=False)
    n_at_risk        = Column(Integer, nullable=False)
    confusion_matrix = Column(JSON, nullable=True)
    feature_importance = Column(JSON, nullable=True)
    trained_at       = Column(DateTime(timezone=True), server_default=func.now())
    is_active        = Column(Boolean, default=True)


# ── Audit Log ─────────────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    action        = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id   = Column(String(50), nullable=True)
    details       = Column(JSON, nullable=True)
    ip_address    = Column(String(50), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
