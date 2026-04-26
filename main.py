"""EduGuard SaaS v2.1 — Main FastAPI Application"""
import os, logging, random
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _ensure_model():
    ml_dir = os.path.join(os.path.dirname(__file__), "ml")
    os.makedirs(ml_dir, exist_ok=True)
    from backend.models.connection import get_db_context
    from backend.models.database import ModelMetrics
    from sqlalchemy import desc
    if os.path.exists(os.path.join(ml_dir,"risk_pipeline.pkl")):
        with get_db_context() as db:
            if db.query(ModelMetrics).filter_by(is_active=True).first():
                logger.info("✅ ML model ready."); return
    logger.info("🧠 Training initial ML model…")
    from data.generator import generate_student_data
    from backend.services.ml_service import train_model
    df = generate_student_data(1200)
    meta = train_model(df)
    with get_db_context() as db:
        db.query(ModelMetrics).filter_by(is_active=True).update({"is_active":False})
        db.add(ModelMetrics(
            model_version=meta["model_version"], f1_score=meta["f1_score"],
            auc_roc=meta["auc_roc"], precision=meta["precision"],
            recall=meta["recall"], avg_precision=meta["avg_precision"],
            threshold=meta["threshold"], n_samples=meta["n_samples"],
            n_at_risk=meta["n_at_risk"], confusion_matrix=meta["confusion_matrix"],
            feature_importance=meta["feature_importance"], is_active=True,
        ))
    logger.info(f"✅ Model F1={meta['f1_score']:.4f}")


def _seed_students():
    from backend.models.connection import get_db_context
    from backend.models.database import Student, Department, Prediction, RiskLevel
    from backend.services.ml_service import predict_students
    from backend.services.alert_service import evaluate_alert_conditions
    from data.generator import generate_student_data
    with get_db_context() as db:
        if db.query(Student).count() > 0:
            logger.info("✅ Students already seeded."); return
        logger.info("🌱 Seeding demo students…")
        df = generate_student_data(200)
        depts = {d.code: d for d in db.query(Department).all()}
        pairs = []
        for _, row in df.iterrows():
            dept = depts.get(row["department"])
            if not dept: continue
            if db.query(Student).filter_by(usn=row["usn"]).first(): continue
            s = Student(
                student_id=row["student_id"], usn=row["usn"],
                full_name=row["full_name"], department_id=dept.id,
                semester=int(row["semester"]), section=random.choice(["A","B","C"]),
                batch_year=int(row["batch_year"]),
                email=row.get("email"), parent_email=row.get("parent_email"),
                attendance_pct=float(row["attendance_pct"]),
                internal_marks=float(row["internal_marks"]),
                assignment_submission_rate=float(row["assignment_submission_rate"]),
                prev_semester_cgpa=float(row["prev_semester_cgpa"]),
                lab_attendance_pct=float(row["lab_attendance_pct"]),
                quiz_avg_score=float(row["quiz_avg_score"]),
                library_visits_per_month=int(row["library_visits_per_month"]),
                extracurricular_participation=bool(row["extracurricular_participation"]),
                active_backlogs=int(row["active_backlogs"]),
            )
            db.add(s)
            try: db.flush(); pairs.append((s, row["department"]))
            except Exception: db.rollback()

        if not pairs: return
        preds = predict_students([{
            "department":d,"semester":s.semester,"attendance_pct":s.attendance_pct,
            "internal_marks":s.internal_marks,"assignment_submission_rate":s.assignment_submission_rate,
            "prev_semester_cgpa":s.prev_semester_cgpa,"lab_attendance_pct":s.lab_attendance_pct,
            "quiz_avg_score":s.quiz_avg_score,"library_visits_per_month":s.library_visits_per_month,
            "extracurricular_participation":int(s.extracurricular_participation),
            "active_backlogs":s.active_backlogs,
        } for s,d in pairs])
        for (s,_), p in zip(pairs, preds):
            conds = evaluate_alert_conditions(s)
            if p["risk_probability"]>=0.55: conds.append("high_risk_score")
            db.add(Prediction(
                student_id=s.id, risk_probability=p["risk_probability"],
                risk_level=RiskLevel(p["risk_level"]), predicted_at_risk=p["predicted_at_risk"],
                top_risk_factors=p["top_risk_factors"], alert_conditions=list(set(conds)),
                model_version=p.get("model_version"),
            ))
        logger.info(f"✅ Seeded {len(pairs)} students.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 EduGuard v2.1 starting…")
    from backend.models.connection import init_db
    init_db()
    _ensure_model()
    _seed_students()
    from backend.services.scheduler import start_scheduler
    start_scheduler()
    logger.info("✅ Ready → http://localhost:8000/api/docs")
    yield
    from backend.services.scheduler import stop_scheduler
    stop_scheduler()


app = FastAPI(title="EduGuard API v2.1", version="2.1.0", lifespan=lifespan,
              docs_url="/api/docs", redoc_url="/api/redoc")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS","*").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

from backend.routers.auth import router as auth_router
from backend.routers.users import router as users_router
from backend.routers.students import router as students_router
from backend.routers.dashboard import dashboard_router, ml_router, alerts_router, dept_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(students_router)
app.include_router(dashboard_router)
app.include_router(ml_router)
app.include_router(alerts_router)
app.include_router(dept_router)

@app.get("/api/health")
def health(): return {"status":"healthy","version":"2.1.0"}

@app.get("/api/scheduler/status")
def sched_status():
    from backend.services.scheduler import get_scheduler_status
    return get_scheduler_status()

_dist = os.path.join(os.path.dirname(__file__),"frontend","dist")
if os.path.isdir(_dist):
    _assets = os.path.join(_dist,"assets")
    if os.path.isdir(_assets):
        app.mount("/assets",StaticFiles(directory=_assets),name="assets")
    @app.get("/{full_path:path}")
    async def spa(full_path:str):
        idx=os.path.join(_dist,"index.html")
        return FileResponse(idx) if os.path.exists(idx) else {"msg":"Build frontend first"}
