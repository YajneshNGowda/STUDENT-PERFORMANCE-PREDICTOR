# 🛡️ EduGuard — Student Risk Intelligence Platform

<div align="center">

![Version](https://img.shields.io/badge/Version-2.2-6366f1?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![XGBoost](https://img.shields.io/badge/XGBoost-2.0-FF6600?style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-57%20Passing-22c55e?style=for-the-badge)

**AI-powered early warning system for engineering colleges.**  
Identifies at-risk students before failures happen — with full explainability, automated alerts, and role-based dashboards.

</div>

---

## 📌 Table of Contents

1. [What is EduGuard?](#-what-is-eduguard)
2. [Features at a Glance](#-features-at-a-glance)
3. [System Architecture](#-system-architecture)
4. [Installation & Setup](#-installation--setup-windows--vs-code)
5. [Login Credentials](#-login-credentials)
6. [USN Format](#-usn-format)
7. [Departments](#-departments)
8. [Project Structure](#-project-structure)
9. [ML Pipeline](#-ml-pipeline)
10. [Alert System](#-alert-system)
11. [Role-Based Access Control](#-role-based-access-control)
12. [API Reference](#-api-reference)
13. [Database Schema](#-database-schema)
14. [UI Pages](#-ui-pages)
15. [Running Tests](#-running-tests)
16. [Docker Deployment](#-docker-deployment)
17. [Environment Variables](#-environment-variables)
18. [Troubleshooting](#-troubleshooting)

---

## 🎯 What is EduGuard?

EduGuard is a **production-ready SaaS platform** that uses machine learning to proactively identify engineering college students who are at risk of academic failure — before it's too late.

### The Problem
> Colleges have thousands of students but limited faculty bandwidth. Struggling students are often identified **too late** — after they've already failed exams or dropped attendance below the threshold.

### The Solution
EduGuard continuously monitors student academic data, runs ML predictions, and automatically alerts faculty, parents, and students when risk is detected — with full AI explainability showing **exactly why** a student is flagged.

---

## ✨ Features at a Glance

| Category | Features |
|---|---|
| 🔐 **Authentication** | 3 login portals (Staff · Student · Parent), JWT, password reset, role-based access |
| 🤖 **ML Engine** | XGBoost + SMOTE, SHAP explainability, 11 features, threshold-tuned |
| 📊 **Dashboards** | Live KPIs, 7-day trend charts, department breakdown, risk distribution |
| 👨‍🎓 **Student Management** | Full CRUD, USN auto-generation, CSV bulk import, individual risk analysis |
| 🚨 **Auto Alerts** | Emails faculty + parent + student automatically on every data change |
| 🏫 **Department Detail** | Per-department deep-dive: risk breakdown, semester bars, full student table |
| 🔬 **Explainability** | SHAP waterfall, radar chart, risk trend, priority recommendations |
| 🌙 **UI/UX** | Dark/light mode, Inter font, glass morphism, fully responsive |
| 🧪 **Tested** | 57 pytest tests covering all routes, RBAC, ML, CSV, alerts |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EduGuard v2.2                                │
├──────────────────┬────────────────────┬────────────────────────────┤
│  React Frontend  │   FastAPI Backend   │       ML Engine            │
│  (Vite + Tailwind│                    │                            │
│                  │  JWT Auth (3 roles) │  XGBoost Classifier        │
│  Login Portal    │  Role Guards        │  SMOTE Oversampling        │
│  Dashboard       │  Student CRUD API   │  SHAP TreeExplainer        │
│  Students        │  Bulk CSV Upload    │  5-Fold CV + Threshold     │
│  Dept Detail     │  Auto Predictions   │  Per-student Risk Factors  │
│  Risk Analysis   │  Alert Service      │                            │
│  Alerts Center   │  APScheduler        │  Daily 8AM Risk Scan       │
│  Student Portal  │  Dashboard API      │  Auto-retrain on demand    │
│  Parent Portal   │                    │                            │
├──────────────────┴────────────────────┴────────────────────────────┤
│                  SQLite / PostgreSQL Database                        │
│    Users · Departments · Students · Predictions · Alerts · Logs     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Installation & Setup (Windows + VS Code)

### Prerequisites
- **Python 3.10+** — https://python.org
- **Node.js 18+** — https://nodejs.org
- **VS Code** — https://code.visualstudio.com

---

### STEP 1 — Open Project in VS Code
```
File → Open Folder → select "eduguard-saas" folder
```

### STEP 2 — Open Terminal
```
Terminal → New Terminal    (or press Ctrl + `)
```

### STEP 3 — Create Virtual Environment
```bash
python -m venv venv
```

### STEP 4 — Activate Virtual Environment
```bash
venv\Scripts\activate
```
> ✅ You will see `(venv)` appear at the start of your terminal line.

### STEP 5 — Install Python Dependencies
```bash
pip install -r requirements.txt
```
> ⏳ Takes 2–4 minutes on first run.

### STEP 6 — Start the Backend Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> ⏳ **First startup takes ~60 seconds.** You will see:

```
✅ DB tables created
🧠 Training initial ML model...
✅ Model F1=1.0000, AUC=1.0000
🌱 Seeding 200 demo students...
✅ Seeded 200 students with risk predictions
✅ Scheduler started — daily scan at 08:00 IST
✅ Ready → http://localhost:8000/api/docs
```

> 🟢 **Keep this terminal open.**

### STEP 7 — Open a Second Terminal
```
Terminal → New Terminal    (or press Ctrl + Shift + `)
```

### STEP 8 — Go to Frontend Folder
```bash
cd frontend
```

### STEP 9 — Install Node Modules
```bash
npm install
```
> ⏳ Takes 1–2 minutes on first run.

### STEP 10 — Start Frontend Dev Server
```bash
npm run dev
```

> ✅ You will see:
```
  VITE v5.x ready in 800ms
  ➜  Local:   http://localhost:5173/
```

> 🟢 **Keep this terminal open too.**

### STEP 11 — Open in Browser
```
http://localhost:5173
```

---

### 🔁 After Restarting VS Code

**Terminal 1 — Backend:**
```bash
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

---

### 🌐 Production Build (optional)

```bash
# Build React app
cd frontend
npm run build

# Backend then serves the built app at http://localhost:8000
cd ..
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 🔑 Login Credentials

### 🔒 Important
> Admin credentials are **never displayed** in the UI. They are loaded from environment variables only, keeping the system secure.

---

### 👑 Super Admin

> Select **"Staff Portal"** on the login page

| Field    | Value                     |
|----------|---------------------------|
| Email    | `admin@eduguard.edu`     |
| Password | `Admin@EduGuard#2025`    |
| Access   | Full system access        |

---

### 🏫 HOD (Head of Department)

> Select **"Staff Portal"** on the login page

| Name              | Email                    | Password     | Department                      |
|-------------------|--------------------------|--------------|---------------------------------|
| Dr. Ramesh Kumar  | `hod.cs@eduguard.edu`   | `Staff@1234` | Computer Science (CS)           |
| Dr. Priya Nair    | `hod.ec@eduguard.edu`   | `Staff@1234` | Electronics & Communication (EC)|

---

### 👨‍🏫 Faculty

> Select **"Staff Portal"** on the login page

| Name               | Email                     | Password     | Department                   |
|--------------------|---------------------------|--------------|------------------------------|
| Prof. Anil Sharma  | `fac.cs1@eduguard.edu`   | `Staff@1234` | Computer Science (CS)        |
| Prof. Sneha Patel  | `fac.cs2@eduguard.edu`   | `Staff@1234` | Computer Science (CS)        |
| Prof. Ravi Menon   | `fac.ec1@eduguard.edu`   | `Staff@1234` | Electronics & Comm (EC)      |
| Prof. Deepak Nath  | `fac.me1@eduguard.edu`   | `Staff@1234` | Mechanical Engineering (ME)  |
| Prof. Kavya Rao    | `fac.is1@eduguard.edu`   | `Staff@1234` | Information Science (IS)     |
| Prof. Mohan Shetty | `fac.ee1@eduguard.edu`   | `Staff@1234` | Electrical Engineering (EE)  |
| Prof. Divya Bhat   | `fac.cg1@eduguard.edu`   | `Staff@1234` | CS & Design (CG)             |

---

### 🎓 Student Login

> Select **"Student Portal"** on the login page

| Field     | Value                                         |
|-----------|-----------------------------------------------|
| Full Name | Student's full name (exactly as registered)   |
| USN       | Student's USN — e.g. `4SN22CS001`            |

**How to find student USNs:**
1. Login as Admin
2. Go to **Students** page
3. Copy any USN from the table

---

### 👨‍👩‍👧 Parent Login

> Select **"Parent Portal"** on the login page

| Field     | Value                        |
|-----------|------------------------------|
| Full Name | Student's full name          |
| USN       | Student's USN                |

> Parents log in with their **ward's name and USN**.

---

## 📋 USN Format

All USNs follow this format:

```
  4 S N Y Y X X 0 0 1
  │         │ │ └─────── Serial number (001, 002, 003 ...)
  │         │ └───────── Department code (CS, IS, EC, EE, ME, CG)
  │         └─────────── Batch / admission year (last 2 digits)
  └───────────────────── College prefix (fixed: 4SN)
```

### Examples by Year

| Academic Year | Batch Code | Department | Example USN  |
|---------------|-----------|------------|--------------|
| 4th Year (Sem 7–8) | `22` | CS | `4SN22CS001` |
| 3rd Year (Sem 5–6) | `23` | ME | `4SN23ME001` |
| 2nd Year (Sem 3–4) | `24` | IS | `4SN24IS001` |
| 1st Year (Sem 1–2) | `25` | CG | `4SN25CG001` |

> ✅ USNs are **auto-generated** when adding students or uploading CSV. No manual entry needed.

---

## 🏫 Departments

| Code  | Full Department Name                  | Icon |
|-------|---------------------------------------|------|
| `CS`  | Computer Science                      | 💻   |
| `IS`  | Information Science                   | 🔍   |
| `EC`  | Electronics and Communication         | 📡   |
| `EE`  | Electrical Engineering                | ⚡   |
| `ME`  | Mechanical Engineering                | ⚙️   |
| `CG`  | Computer Science and Design           | 🎨   |

> Click any department card to see its **full detail page** — risk breakdown by level, semester-wise analysis, and complete student table.

---

## 📁 Project Structure

```
eduguard-saas/
│
├── 📄 main.py                          ← FastAPI entry point
│                                         Auto-seeds DB, trains model, starts scheduler
├── 📄 requirements.txt                 ← All Python dependencies
├── 📄 conftest.py                      ← pytest test configuration
├── 📄 Dockerfile                       ← Container build file
├── 📄 docker-compose.yml               ← Multi-service deployment
├── 📄 .env.example                     ← Environment variable template
│
├── 📂 backend/
│   ├── 📂 models/
│   │   ├── database.py                 ← SQLAlchemy ORM (7 tables)
│   │   ├── connection.py               ← DB engine + seeder
│   │   └── schemas.py                  ← Pydantic v2 schemas
│   │
│   ├── 📂 routers/
│   │   ├── auth.py                     ← Login (3 portals), logout, password reset
│   │   ├── students.py                 ← CRUD + CSV + risk analysis endpoint
│   │   ├── users.py                    ← User management
│   │   └── dashboard.py                ← Dashboard, ML, alerts, departments
│   │
│   ├── 📂 services/
│   │   ├── ml_service.py               ← XGBoost + SMOTE + SHAP
│   │   ├── alert_service.py            ← Auto email → faculty + parent + student
│   │   └── scheduler.py               ← Daily 8AM APScheduler job
│   │
│   └── 📂 utils/
│       └── security.py                 ← JWT + bcrypt + role guards
│
├── 📂 data/
│   └── generator.py                    ← Synthetic data (USN format 4SNYYXX001)
│
├── 📂 ml/                              ← Auto-created on first run
│   ├── risk_pipeline.pkl               ← Trained model
│   ├── shap_explainer.pkl              ← SHAP explainer
│   └── model_meta.json                 ← Metrics + feature importance
│
├── 📂 frontend/
│   ├── index.html                      ← Entry point
│   ├── package.json                    ← Node dependencies
│   ├── vite.config.js                  ← Build config
│   ├── tailwind.config.js              ← Design tokens
│   └── 📂 src/
│       ├── App.jsx                     ← Router + role-based routes
│       ├── index.css                   ← Full design system
│       │
│       ├── 📂 context/
│       │   ├── AuthContext.jsx         ← JWT auth state
│       │   └── ThemeContext.jsx        ← Dark/light mode
│       │
│       ├── 📂 components/
│       │   ├── layout/AppLayout.jsx    ← Sidebar + topbar
│       │   └── ui/index.jsx            ← Reusable UI components
│       │
│       ├── 📂 utils/
│       │   ├── api.js                  ← Axios with auth interceptors
│       │   └── helpers.js              ← Formatters, risk colors, USN preview
│       │
│       └── 📂 pages/
│           ├── Login.jsx               ← Dark 3-portal login page
│           ├── Dashboard.jsx           ← Live KPIs + charts
│           ├── Students.jsx            ← CRUD + CSV upload
│           ├── Alerts.jsx              ← Alert center
│           ├── Model.jsx               ← ML metrics + SHAP
│           ├── Departments.jsx         ← Dept overview cards
│           ├── DepartmentDetail.jsx    ← ★ Per-dept deep-dive page
│           ├── RiskAnalysis.jsx        ← Individual student analysis
│           ├── StudentPortal.jsx       ← Student/parent self-service
│           └── Users.jsx              ← User management + settings
│
└── 📂 tests/
    └── test_api.py                     ← 57 pytest tests
```

---

## 🤖 ML Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    ML Pipeline Flow                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Student Data (11 features)                             │
│         ↓                                               │
│  ┌─────────────────────┐                               │
│  │  SMOTE Oversampling  │  ← Handles 18% minority class │
│  │  strategy = 0.5      │    synthetically              │
│  └──────────┬──────────┘                               │
│             ↓                                           │
│  ┌─────────────────────┐                               │
│  │  XGBoost Classifier  │  n_estimators = 400           │
│  │                      │  max_depth    = 5             │
│  │                      │  learning_rate = 0.05         │
│  │                      │  scale_pos_weight = auto      │
│  └──────────┬──────────┘                               │
│             ↓                                           │
│  ┌─────────────────────┐                               │
│  │  5-Fold Stratified   │  ← Honest cross-validation    │
│  │  Cross-Validation    │                               │
│  │  + Threshold Tuning  │  ← Maximises F1 score        │
│  └──────────┬──────────┘                               │
│             ↓                                           │
│  ┌─────────────────────┐                               │
│  │  SHAP TreeExplainer  │  ← Per-student explainability │
│  │  Top-5 Risk Factors  │    with direction + impact    │
│  └──────────┬──────────┘                               │
│             ↓                                           │
│  ┌──────────────────────────────────────┐              │
│  │          Risk Level Assignment        │              │
│  │  Probability   │   Level             │              │
│  │  < 30%         │   🟢 Low            │              │
│  │  30% – 55%     │   🟡 Medium         │              │
│  │  55% – 75%     │   🟠 High           │              │
│  │  > 75%         │   🔴 Critical       │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Model Performance

| Metric          | Score    | Target | Status  |
|-----------------|----------|--------|---------|
| **F1 Score**    | `1.0000` | ≥ 0.78 | ✅ Pass |
| **AUC-ROC**     | `1.0000` | ≥ 0.85 | ✅ Pass |
| **Precision**   | `1.0000` | —      | ✅      |
| **Recall**      | `1.0000` | —      | ✅      |
| **Threshold**   | `0.23`   | tuned  | ✅      |
| **CV Folds**    | 5        | —      | ✅      |

### Features Used

| # | Feature                        | Description                         |
|---|--------------------------------|-------------------------------------|
| 1 | `attendance_pct`              | Lecture attendance %                |
| 2 | `internal_marks`              | Mid-semester exam average           |
| 3 | `assignment_submission_rate`  | % assignments submitted on time     |
| 4 | `prev_semester_cgpa`          | Previous semester CGPA              |
| 5 | `lab_attendance_pct`          | Practical session attendance        |
| 6 | `quiz_avg_score`              | Average quiz/test score             |
| 7 | `library_visits_per_month`    | Self-study engagement proxy         |
| 8 | `extracurricular_participation`| Participation flag (0/1)           |
| 9 | `active_backlogs`             | Uncleared previous subjects         |
| 10| `department`                  | Encoded dept (CS/IS/EC/EE/ME/CG)   |
| 11| `semester`                    | Current semester (1–8)             |

---

## 🚨 Alert System

### How It Works

Alerts fire **fully automatically** — no manual button press needed.

```
Student data changed
       ↓
  ML Prediction runs
       ↓
  Conditions evaluated
       ↓
  High/Critical OR condition triggered?
       ↓
  ┌────────────────────────────────────┐
  │    Email sent to:                  │
  │    ✉  Faculty / HOD               │
  │    ✉  Parent (if email set)       │
  │    ✉  Student (if email set)      │
  └────────────────────────────────────┘
       ↓
  Alert saved to DB with status
```

### Trigger Events

| Trigger       | When it fires                              |
|---------------|--------------------------------------------|
| `create`      | New student added to system                |
| `update`      | Any student academic data updated          |
| `csv_upload`  | Bulk CSV file imported                     |
| `scheduler`   | Daily automatic scan at **8:00 AM IST**    |

### Alert Conditions

| Condition              | Rule                             |
|------------------------|----------------------------------|
| ⚠ Low Attendance      | Attendance **< 75%**            |
| ⚠ Poor Marks          | Internal marks **< 40**         |
| ⚠ Consecutive Failure | Active backlogs **≥ 2**         |
| ⚠ Multiple Backlogs   | Active backlogs **> 3**         |
| ⚠ Performance Drop    | CGPA **< 5.0** (and > 0)       |
| ⚠ High Risk Score     | Risk probability **≥ 55%**      |

### Console Output (No SendGrid Needed)

Even without email configuration, every alert prints clearly to the terminal:

```
======================================================================
  📧 EMAIL ALERT [FACULTY]
  To      : fac.cs1@eduguard.edu
  Subject : [EduGuard Alert] High Risk — Arjun Kumar (4SN22CS001)
  Student : Arjun Kumar (4SN22CS001)
  Risk    : High (67.3%)
  Time    : 22 Apr 2026 14:35:22
======================================================================

======================================================================
  📧 EMAIL ALERT [PARENT]
  To      : parent.4sn22cs001@gmail.com
  Subject : [EduGuard Alert] High Risk — Arjun Kumar (4SN22CS001)
  Student : Arjun Kumar (4SN22CS001)
  Risk    : High (67.3%)
  Time    : 22 Apr 2026 14:35:22
======================================================================

======================================================================
  📧 EMAIL ALERT [STUDENT]
  To      : arjun.kumar.4sn22cs001@college.edu
  Subject : [EduGuard Alert] High Risk — Arjun Kumar (4SN22CS001)
  Student : Arjun Kumar (4SN22CS001)
  Risk    : High (67.3%)
  Time    : 22 Apr 2026 14:35:22
======================================================================
```

### Enable Real Emails

Create a `.env` file:
```env
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=alerts@yourcollege.edu
```

> Get a free SendGrid API key at https://sendgrid.com

---

## 👥 Role-Based Access Control

| Feature                     | Admin | HOD     | Faculty      | Student   | Parent    |
|-----------------------------|:-----:|:-------:|:------------:|:---------:|:---------:|
| All departments             | ✅    | ❌      | ❌           | ❌        | ❌        |
| Own department              | ✅    | ✅      | ✅           | ✅        | ✅        |
| Create / delete users       | ✅    | ❌      | ❌           | ❌        | ❌        |
| View users in dept          | ✅    | ✅      | ❌           | ❌        | ❌        |
| Retrain ML model            | ✅    | ❌      | ❌           | ❌        | ❌        |
| Student CRUD                | ✅    | ✅      | Own dept     | ❌        | ❌        |
| CSV bulk upload             | ✅    | ✅      | Own dept     | ❌        | ❌        |
| Individual risk analysis    | ✅    | ✅      | ✅           | Own only  | Own child |
| View alerts                 | ✅    | ✅      | Own dept     | ❌        | ❌        |
| Acknowledge alerts          | ✅    | ✅      | ✅           | ❌        | ❌        |
| Department detail page      | ✅    | ✅      | ✅           | ❌        | ❌        |
| Edit own profile/password   | ✅    | ✅      | ✅           | ❌        | ❌        |

---

## 🔌 API Reference

> Full interactive docs: **http://localhost:8000/api/docs**

### Authentication

| Method | Endpoint                     | Who can use   | Description                        |
|--------|------------------------------|---------------|------------------------------------|
| POST   | `/api/auth/login`            | Staff         | Login with email + password        |
| POST   | `/api/auth/student-login`    | Students      | Login with name + USN              |
| POST   | `/api/auth/parent-login`     | Parents       | Login with student name + USN      |
| POST   | `/api/auth/logout`           | All           | Logout                             |
| GET    | `/api/auth/me`               | All           | Get current user profile           |
| POST   | `/api/auth/forgot-password`  | Staff         | Send password reset email          |
| POST   | `/api/auth/reset-password`   | Staff         | Reset with token from email        |
| POST   | `/api/auth/change-password`  | Staff         | Change own password                |

### Students

| Method | Endpoint                           | Who can use        | Description                          |
|--------|------------------------------------|--------------------|--------------------------------------|
| GET    | `/api/students`                    | Staff              | List students (role-filtered)        |
| POST   | `/api/students`                    | Staff              | Add student + predict + auto-alert   |
| GET    | `/api/students/my-profile`         | Student / Parent   | View own / child's record            |
| GET    | `/api/students/{id}`               | Staff + own        | Get student detail                   |
| PATCH  | `/api/students/{id}`               | Staff              | Update + re-predict + auto-alert     |
| DELETE | `/api/students/{id}`               | Admin + HOD        | Soft delete                          |
| GET    | `/api/students/{id}/predictions`   | Staff + own        | Prediction history                   |
| GET    | `/api/students/{id}/risk-analysis` | Staff + own        | Full SHAP + recommendations          |
| POST   | `/api/students/bulk/upload`        | Staff              | CSV import + batch predict + alert   |

### Dashboard & ML

| Method | Endpoint                        | Who can use | Description                       |
|--------|---------------------------------|-------------|-----------------------------------|
| GET    | `/api/dashboard/overview`       | All staff   | Live KPIs, trend, dept breakdown  |
| GET    | `/api/ml/metrics`               | All staff   | F1, AUC, confusion matrix         |
| GET    | `/api/ml/feature-importance`    | All staff   | Global SHAP importances           |
| POST   | `/api/ml/train`                 | Admin only  | Retrain model in background       |
| GET    | `/api/alerts`                   | Staff       | Alert list with filters           |
| POST   | `/api/alerts/{id}/acknowledge`  | Staff       | Acknowledge an alert              |
| GET    | `/api/departments`              | All staff   | Departments with risk counts      |

---

## 🗄️ Database Schema

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────────┐
│ departments  │     │    users     │     │       students        │
│──────────────│     │──────────────│     │───────────────────────│
│ id           │◄────│ dept_id(FK)  │     │ id                    │
│ code         │     │ email        │     │ student_id (USN)      │
│ name         │     │ username     │     │ usn  (4SNYYXX001)     │
│ is_active    │     │ full_name    │     │ full_name             │
└──────────────┘     │ hashed_pw    │     │ email                 │
                     │ role         │     │ parent_email          │
                     │ linked_      │     │ department_id (FK)    │
                     │  student_id  │     │ semester / section    │
                     └──────────────┘     │ batch_year            │
                                          │ attendance_pct        │
                                          │ internal_marks        │
                                          │ assignment_rate       │
                                          │ prev_cgpa             │
                                          │ lab_attendance        │
                                          │ quiz_avg_score        │
                                          │ library_visits        │
┌──────────────────┐  ┌──────────────┐   │ active_backlogs       │
│   predictions    │  │    alerts    │   └───────────────────────┘
│──────────────────│  │──────────────│
│ student_id (FK)  │  │ student_id   │   ┌───────────────────────┐
│ risk_probability │  │ risk_level   │   │    model_metrics      │
│ risk_level       │  │ conditions   │   │───────────────────────│
│ predicted_at_risk│  │ message      │   │ model_version         │
│ top_risk_factors │  │ status       │   │ f1_score              │
│ alert_conditions │  │ faculty_email│   │ auc_roc               │
│ model_version    │  │ parent_email │   │ precision / recall    │
│ created_at       │  │ trigger      │   │ confusion_matrix      │
└──────────────────┘  │ acknowledged │   │ feature_importance    │
                      └──────────────┘   │ trained_at            │
                                         └───────────────────────┘
┌──────────────────────────────────────────────────────┐
│                    audit_logs                         │
│  user_id │ action │ resource_type │ details │ ip     │
└──────────────────────────────────────────────────────┘
```

---

## 🖥️ UI Pages

| Page                  | Route                    | Who sees it        | What it shows                              |
|-----------------------|--------------------------|--------------------|---------------------------------------------|
| **Login**             | `/login`                 | Everyone           | 3-portal dark split-screen, no watermarks  |
| **Dashboard**         | `/dashboard`             | Staff              | KPIs, area chart, dept bars, quick actions |
| **Students**          | `/students`              | Staff              | Table with CRUD, CSV upload, risk drawer   |
| **Individual Risk**   | `/students/:id/risk`     | Staff              | SHAP bars, radar, trend chart, action plan |
| **Alerts**            | `/alerts`                | Staff              | Alert cards, filter by status/risk, acknowledge |
| **Model & Metrics**   | `/model`                 | Staff              | F1/AUC/Precision, confusion matrix, SHAP   |
| **Departments**       | `/departments`           | Admin              | 6 dept cards with risk indicators          |
| **Dept Detail**       | `/departments/:code`     | Staff              | ★ Risk breakdown, semester bars, student table |
| **User Management**   | `/users`                 | Admin + HOD        | Card grid of users, add/edit/delete        |
| **Settings**          | `/settings`              | All staff          | Profile info, change password              |
| **Student Portal**    | `/my-profile`            | Students           | Read-only profile + risk + recommendations |
| **Parent Portal**     | `/my-profile`            | Parents            | Read-only child profile + progress         |

---

## 🧪 Running Tests

```bash
# Run all 57 tests
pytest tests/ -v

# Run a specific group
pytest tests/test_api.py::TestAuthentication -v
pytest tests/test_api.py::TestStudentCRUD -v
pytest tests/test_api.py::TestMLPrediction -v
```

**Test coverage:**

| Test Group               | Tests | What it covers                                         |
|--------------------------|-------|--------------------------------------------------------|
| `TestHealth`             | 4     | Server health, API version, auth guards                |
| `TestAuthentication`     | 9     | Login all 3 roles, wrong credentials, forgot password  |
| `TestRBAC`               | 6     | Faculty blocked, HOD scoped, admin unrestricted        |
| `TestDepartments`        | 2     | All 6 depts seeded, counts present                     |
| `TestStudentCRUD`        | 9     | Create, duplicate check, update, delete, search        |
| `TestMLPrediction`       | 4     | At-risk flagged, safe not flagged, F1≥0.78, SHAP       |
| `TestAlerts`             | 3     | Alert created for high-risk, acknowledge flow          |
| `TestDashboard`          | 4     | Structure, counts consistent, 7-day trend              |
| `TestUsers`              | 5     | Create, duplicate reject, delete, can't delete self    |
| `TestCsvUpload`          | 3     | Valid upload, bad extension, missing columns           |
| `TestStudentParentLogin` | 5     | USN format, wrong name, read-only access enforced      |
| **Total**                | **57**| All passing ✅                                        |

---

## 🐳 Docker Deployment

```bash
# Build and start
docker compose up --build

# Access at http://localhost:8000

# Stop
docker compose down
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in values:

```env
# ── Database ──────────────────────────────────────
# SQLite (default — no setup needed)
DATABASE_URL=sqlite:///./eduguard.db

# PostgreSQL (for production)
# DATABASE_URL=postgresql://user:pass@localhost:5432/eduguard

# ── Security ──────────────────────────────────────
# Generate: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=change-me-in-production-use-random-hex

ACCESS_TOKEN_EXPIRE_MINUTES=480

# ── Admin Account ──────────────────────────────────
ADMIN_EMAIL=admin@eduguard.edu
ADMIN_PASSWORD=Admin@EduGuard#2025

# ── CORS ──────────────────────────────────────────
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ── Email Alerts (SendGrid) ───────────────────────
# SENDGRID_API_KEY=SG.your_key_here
# FROM_EMAIL=alerts@yourcollege.edu

# ── SMS Alerts (Twilio — optional) ───────────────
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=your_token
# TWILIO_PHONE_FROM=+1234567890
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|---------|
| `venv\Scripts\activate` fails | Run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` then try again |
| `npm` is not recognized | Download and install Node.js from https://nodejs.org, then restart VS Code |
| Port 8000 already in use | Use `--port 8001` in the uvicorn command |
| Port 5173 already in use | Run `npm run dev -- --port 5174` |
| Student login fails | Name must match exactly (case-insensitive). USN format: `4SN22CS001` |
| No alert emails received | No SendGrid key? Alerts still print to terminal — check VS Code terminal output |
| Parent email not working | Add `parent_email` when creating or editing the student record |
| Student email not working | Add `email` when creating or editing the student record |
| First startup very slow | Normal — first run trains the ML model (~60 seconds) |
| `ModuleNotFoundError` | Make sure virtual environment is activated: `venv\Scripts\activate` |
| DB errors after code change | Delete `eduguard.db` and restart — DB will be recreated automatically |

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| Backend files | 15 Python files |
| Frontend files | 16 React/JSX files |
| API endpoints | 25 endpoints |
| Database tables | 7 tables |
| Test cases | 57 passing |
| ML features | 11 features |
| Departments | 6 departments |
| User roles | 5 roles |
| Alert channels | 3 (faculty + parent + student) |

---

## 📄 License

MIT License — free to use, modify, and deploy for educational purposes.

---

<div align="center">

**EduGuard v2.2**

Built with ❤️ using FastAPI · React · XGBoost · SHAP · SQLite · APScheduler

*Protecting every student's future with AI*

</div>
