"""
Database engine, session, and initialization.
Supports SQLite (default) and PostgreSQL via DATABASE_URL env var.
"""

import os
import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
from .database import Base

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./eduguard.db"
)

# SQLite-specific settings for concurrency
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    # Enable WAL mode for better concurrency
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency for DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for non-FastAPI use (scheduler, scripts)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Create all tables and seed initial data."""
    from .database import Base
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created.")
    seed_initial_data()


def seed_initial_data():
    """Seed departments and a default super admin."""
    from .database import Department, User, UserRole, ModelMetrics
    from ..utils.security import hash_password
    from datetime import datetime

    with get_db_context() as db:
        # Departments
        departments = [
            {"code": "CSE",  "name": "Computer Science & Engineering"},
            {"code": "ISE",  "name": "Information Science & Engineering"},
            {"code": "AIML", "name": "Artificial Intelligence & Machine Learning"},
            {"code": "ECE",  "name": "Electronics & Communication Engineering"},
            {"code": "EEE",  "name": "Electrical & Electronics Engineering"},
            {"code": "MECH", "name": "Mechanical Engineering"},
            {"code": "CIVIL","name": "Civil Engineering"},
        ]
        for dept_data in departments:
            existing = db.query(Department).filter_by(code=dept_data["code"]).first()
            if not existing:
                db.add(Department(**dept_data))

        db.flush()

        # Super admin
        admin_email = os.getenv("ADMIN_EMAIL", "admin@eduguard.edu")
        admin_pass  = os.getenv("ADMIN_PASSWORD", "Admin@123")
        existing_admin = db.query(User).filter_by(email=admin_email).first()
        if not existing_admin:
            db.add(User(
                email=admin_email,
                username="superadmin",
                full_name="Super Administrator",
                hashed_password=hash_password(admin_pass),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True,
            ))
            logger.info(f"✅ Super admin created: {admin_email} / {admin_pass}")

        # Demo HOD and faculty users
        demo_users = [
            {"email":"hod.cse@eduguard.edu","username":"hod_cse","full_name":"Dr. Ramesh Kumar","role":UserRole.HOD,"dept":"CSE","password":"Hod@1234"},
            {"email":"hod.ece@eduguard.edu","username":"hod_ece","full_name":"Dr. Priya Nair","role":UserRole.HOD,"dept":"ECE","password":"Hod@1234"},
            {"email":"faculty.cse1@eduguard.edu","username":"fac_cse1","full_name":"Prof. Anil Sharma","role":UserRole.FACULTY,"dept":"CSE","password":"Faculty@123"},
            {"email":"faculty.cse2@eduguard.edu","username":"fac_cse2","full_name":"Prof. Sneha Patel","role":UserRole.FACULTY,"dept":"CSE","password":"Faculty@123"},
            {"email":"faculty.ece1@eduguard.edu","username":"fac_ece1","full_name":"Prof. Ravi Menon","role":UserRole.FACULTY,"dept":"ECE","password":"Faculty@123"},
            {"email":"faculty.mech1@eduguard.edu","username":"fac_mech1","full_name":"Prof. Deepak Nath","role":UserRole.FACULTY,"dept":"MECH","password":"Faculty@123"},
        ]
        for u in demo_users:
            if not db.query(User).filter_by(email=u["email"]).first():
                dept = db.query(Department).filter_by(code=u["dept"]).first()
                db.add(User(
                    email=u["email"], username=u["username"], full_name=u["full_name"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"], department_id=dept.id if dept else None,
                    is_active=True, is_verified=True,
                ))

        logger.info("✅ Seed data complete.")
