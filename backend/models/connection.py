"""
Database engine, session, and initialization.
"""
import os, logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
from .database import Base

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./eduguard.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool, echo=False,
    )
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
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
    Base.metadata.create_all(bind=engine)
    logger.info("✅ DB tables created.")
    _seed_master_data()


def _seed_master_data():
    from .database import Department, User, UserRole
    from ..utils.security import hash_password

    DEPARTMENTS = [
        ("CS",  "Computer Science"),
        ("IS",  "Information Science"),
        ("EC",  "Electronics and Communication"),
        ("EE",  "Electrical Engineering"),
        ("ME",  "Mechanical Engineering"),
        ("CG",  "Computer Science and Design"),
    ]

    with get_db_context() as db:
        for code, name in DEPARTMENTS:
            if not db.query(Department).filter_by(code=code).first():
                db.add(Department(code=code, name=name))
        db.flush()

        # Super admin — credentials from env, NOT hardcoded/displayed
        admin_email = os.getenv("ADMIN_EMAIL", "admin@eduguard.edu")
        admin_pass  = os.getenv("ADMIN_PASSWORD", "Admin@EduGuard#2025")
        if not db.query(User).filter_by(email=admin_email).first():
            db.add(User(
                email=admin_email, username="admin",
                full_name="System Administrator",
                hashed_password=hash_password(admin_pass),
                role=UserRole.SUPER_ADMIN,
                is_active=True, is_verified=True,
            ))

        # Demo HOD + faculty per department
        demo_staff = [
            ("hod.cs@eduguard.edu",  "hod_cs",   "Dr. Ramesh Kumar",   UserRole.HOD,     "CS"),
            ("hod.ec@eduguard.edu",  "hod_ec",   "Dr. Priya Nair",     UserRole.HOD,     "EC"),
            ("fac.cs1@eduguard.edu", "fac_cs1",  "Prof. Anil Sharma",  UserRole.FACULTY, "CS"),
            ("fac.cs2@eduguard.edu", "fac_cs2",  "Prof. Sneha Patel",  UserRole.FACULTY, "CS"),
            ("fac.ec1@eduguard.edu", "fac_ec1",  "Prof. Ravi Menon",   UserRole.FACULTY, "EC"),
            ("fac.me1@eduguard.edu", "fac_me1",  "Prof. Deepak Nath",  UserRole.FACULTY, "ME"),
            ("fac.is1@eduguard.edu", "fac_is1",  "Prof. Kavya Rao",    UserRole.FACULTY, "IS"),
            ("fac.ee1@eduguard.edu", "fac_ee1",  "Prof. Mohan Shetty", UserRole.FACULTY, "EE"),
            ("fac.cg1@eduguard.edu", "fac_cg1",  "Prof. Divya Bhat",   UserRole.FACULTY, "CG"),
        ]
        for email, uname, fname, role, dept_code in demo_staff:
            if not db.query(User).filter_by(email=email).first():
                dept = db.query(Department).filter_by(code=dept_code).first()
                db.add(User(
                    email=email, username=uname, full_name=fname,
                    hashed_password=hash_password("Staff@1234"),
                    role=role, department_id=dept.id if dept else None,
                    is_active=True, is_verified=True,
                ))

        logger.info("✅ Master data seeded.")
