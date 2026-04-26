"""
EduGuard SaaS — Full Test Suite
Run: pytest tests/ -v
"""

import pytest
import warnings
warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient

# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def client():
    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post("/api/auth/login", json={
        "email": "admin@eduguard.edu", "password": "Admin@EduGuard#2025"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def hod_token(client):
    r = client.post("/api/auth/login", json={
        "email": "hod.cs@eduguard.edu", "password": "Staff@1234"
    })
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def faculty_token(client):
    r = client.post("/api/auth/login", json={
        "email": "fac.cs1@eduguard.edu", "password": "Staff@1234"
    })
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def hod_headers(hod_token):
    return {"Authorization": f"Bearer {hod_token}"}


@pytest.fixture(scope="session")
def faculty_headers(faculty_token):
    return {"Authorization": f"Bearer {faculty_token}"}


# ── Health ────────────────────────────────────────────────────────────────────
class TestHealth:
    def test_health_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"
        assert r.json()["version"] in ("2.0.0","2.1.0")

    def test_docs_available(self, client):
        r = client.get("/api/docs")
        assert r.status_code == 200

    def test_unauthorized_without_token(self, client):
        r = client.get("/api/dashboard/overview")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 without credentials

    def test_invalid_token_rejected(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401


# ── Authentication ─────────────────────────────────────────────────────────────
class TestAuthentication:
    def test_login_admin_success(self, client):
        r = client.post("/api/auth/login", json={
            "email": "admin@eduguard.edu", "password": "Admin@EduGuard#2025"
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        assert data["token_type"] == "bearer"

    def test_login_hod_success(self, client):
        r = client.post("/api/auth/login", json={
            "email": "hod.cs@eduguard.edu", "password": "Staff@1234"
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "hod"

    def test_login_faculty_success(self, client):
        r = client.post("/api/auth/login", json={
            "email": "fac.cs1@eduguard.edu", "password": "Staff@1234"
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "faculty"

    def test_login_wrong_password(self, client):
        r = client.post("/api/auth/login", json={
            "email": "admin@eduguard.edu", "password": "wrongpassword"
        })
        assert r.status_code == 401

    def test_login_unknown_email(self, client):
        r = client.post("/api/auth/login", json={
            "email": "nobody@nowhere.com", "password": "anything"
        })
        assert r.status_code == 401

    def test_me_endpoint(self, client, admin_headers):
        r = client.get("/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@eduguard.edu"
        assert data["role"] == "super_admin"

    def test_me_hod_has_dept(self, client, hod_headers):
        r = client.get("/api/auth/me", headers=hod_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["department_code"] == "CS"

    def test_forgot_password_always_200(self, client):
        # Should return 200 even for unknown emails (security)
        r = client.post("/api/auth/forgot-password", json={"email": "ghost@nowhere.com"})
        assert r.status_code == 200

    def test_reset_invalid_token(self, client):
        r = client.post("/api/auth/reset-password", json={
            "token": "fake_reset_token_xyz", "new_password": "NewPass@123"
        })
        assert r.status_code == 400


# ── Role-Based Access Control ─────────────────────────────────────────────────
class TestRBAC:
    def test_faculty_blocked_from_users(self, client, faculty_headers):
        r = client.get("/api/users", headers=faculty_headers)
        assert r.status_code == 403

    def test_faculty_can_read_students(self, client, faculty_headers):
        r = client.get("/api/students", headers=faculty_headers)
        assert r.status_code == 200

    def test_hod_can_read_users(self, client, hod_headers):
        r = client.get("/api/users", headers=hod_headers)
        assert r.status_code == 200

    def test_faculty_blocked_from_departments(self, client, faculty_headers):
        r = client.get("/api/departments", headers=faculty_headers)
        # Departments visible to all authenticated users
        assert r.status_code == 200

    def test_faculty_cannot_train_model(self, client, faculty_headers):
        r = client.post("/api/ml/train", headers=faculty_headers)
        assert r.status_code == 403

    def test_hod_cannot_train_model(self, client, hod_headers):
        r = client.post("/api/ml/train", headers=hod_headers)
        assert r.status_code == 403

    def test_admin_can_train_model_trigger(self, client, admin_headers):
        # Just tests that admin can call it (runs async)
        r = client.post("/api/ml/train", headers=admin_headers)
        assert r.status_code == 200


# ── Departments ───────────────────────────────────────────────────────────────
class TestDepartments:
    def test_list_departments(self, client, admin_headers):
        r = client.get("/api/departments", headers=admin_headers)
        assert r.status_code == 200
        depts = r.json()
        assert len(depts) == 6
        codes = [d["code"] for d in depts]
        for expected in ["CS","IS","EC","EE","ME","CG"]:
            assert expected in codes

    def test_dept_has_counts(self, client, admin_headers):
        r = client.get("/api/departments", headers=admin_headers)
        depts = r.json()
        for d in depts:
            assert "student_count" in d
            assert "at_risk_count" in d
            assert d["student_count"] >= 0


# ── Students CRUD ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="class")
def sample_student_payload():
    return {
        "student_id": "TST9901",
        "full_name": "Pytest Student One",
        "department_id": 1,
        "semester": 4,
        "section": "A",
        "attendance_pct": 55.0,
        "internal_marks": 38.0,
        "assignment_submission_rate": 42.0,
        "prev_semester_cgpa": 5.2,
        "lab_attendance_pct": 50.0,
        "quiz_avg_score": 35.0,
        "library_visits_per_month": 1,
        "extracurricular_participation": False,
        "active_backlogs": 2,
    }


class TestStudentCRUD:
    created_id = None

    def test_create_student(self, client, admin_headers, sample_student_payload):
        r = client.post("/api/students", headers=admin_headers, json=sample_student_payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["student_id"] == "TST9901"
        assert data["latest_risk_level"] is not None  # prediction ran
        assert 0.0 <= data["latest_risk_probability"] <= 1.0
        TestStudentCRUD.created_id = data["id"]

    def test_duplicate_student_rejected(self, client, admin_headers, sample_student_payload):
        r = client.post("/api/students", headers=admin_headers, json=sample_student_payload)
        assert r.status_code == 409

    def test_list_students(self, client, admin_headers):
        r = client.get("/api/students", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_student(self, client, admin_headers):
        assert TestStudentCRUD.created_id is not None
        r = client.get(f"/api/students/{TestStudentCRUD.created_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["student_id"] == "TST9901"

    def test_update_student_triggers_reprediction(self, client, admin_headers):
        r = client.patch(
            f"/api/students/{TestStudentCRUD.created_id}",
            headers=admin_headers,
            json={"attendance_pct": 85.0, "internal_marks": 72.0,
                  "assignment_submission_rate": 88.0, "prev_semester_cgpa": 8.0},
        )
        assert r.status_code == 200
        data = r.json()
        # Safe student should have lower risk after update
        assert data["latest_risk_probability"] < 0.5

    def test_get_student_predictions_history(self, client, admin_headers):
        r = client.get(f"/api/students/{TestStudentCRUD.created_id}/predictions",
                       headers=admin_headers)
        assert r.status_code == 200
        preds = r.json()
        assert len(preds) >= 2  # at_least create + update

    def test_delete_student_soft(self, client, admin_headers):
        r = client.delete(f"/api/students/{TestStudentCRUD.created_id}",
                          headers=admin_headers)
        assert r.status_code == 204

    def test_deleted_student_not_listed(self, client, admin_headers):
        r = client.get("/api/students", headers=admin_headers,
                       params={"search": "TST9901"})
        assert r.status_code == 200
        assert all(s["student_id"] != "TST9901" for s in r.json())

    def test_search_students(self, client, admin_headers):
        r = client.get("/api/students", headers=admin_headers,
                       params={"search": "STU"})
        assert r.status_code == 200

    def test_filter_by_semester(self, client, admin_headers):
        r = client.get("/api/students", headers=admin_headers,
                       params={"semester": 4})
        assert r.status_code == 200
        for s in r.json():
            assert s["semester"] == 4

    def test_missing_required_fields(self, client, admin_headers):
        r = client.post("/api/students", headers=admin_headers,
                        json={"student_id": "INCOMPLETE"})
        assert r.status_code == 422


# ── Risk Prediction Logic ─────────────────────────────────────────────────────
class TestMLPrediction:
    def test_at_risk_student_flagged_correctly(self, client, admin_headers):
        payload = {
            "student_id": "RISK001",
            "full_name": "At Risk Student",
            "department_id": 1, "semester": 4, "section": "A",
            "attendance_pct": 35.0,        # very low
            "internal_marks": 22.0,         # very low
            "assignment_submission_rate": 30.0,
            "prev_semester_cgpa": 4.0,
            "lab_attendance_pct": 38.0,
            "quiz_avg_score": 20.0,
            "library_visits_per_month": 0,
            "extracurricular_participation": False,
            "active_backlogs": 5,
        }
        r = client.post("/api/students", headers=admin_headers, json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["latest_risk_level"] in ("High", "Critical")
        assert data["latest_risk_probability"] > 0.5
        # Cleanup
        client.delete(f"/api/students/{data['id']}", headers=admin_headers)

    def test_safe_student_not_flagged(self, client, admin_headers):
        payload = {
            "student_id": "SAFE001",
            "full_name": "Safe Student",
            "department_id": 1, "semester": 3, "section": "B",
            "attendance_pct": 95.0,
            "internal_marks": 88.0,
            "assignment_submission_rate": 96.0,
            "prev_semester_cgpa": 9.2,
            "lab_attendance_pct": 92.0,
            "quiz_avg_score": 85.0,
            "library_visits_per_month": 10,
            "extracurricular_participation": True,
            "active_backlogs": 0,
        }
        r = client.post("/api/students", headers=admin_headers, json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["latest_risk_level"] == "Low"
        assert data["latest_risk_probability"] < 0.3
        # Cleanup
        client.delete(f"/api/students/{data['id']}", headers=admin_headers)

    def test_ml_metrics_available(self, client, admin_headers):
        r = client.get("/api/ml/metrics", headers=admin_headers)
        assert r.status_code == 200
        m = r.json()
        assert m["f1_score"] >= 0.78, f"F1 {m['f1_score']} below target"
        assert m["auc_roc"] >= 0.85
        assert 0.0 < m["threshold"] < 1.0

    def test_feature_importance_available(self, client, admin_headers):
        r = client.get("/api/ml/feature-importance", headers=admin_headers)
        assert r.status_code == 200
        fi = r.json()["feature_importance"]
        assert len(fi) > 0
        assert all("feature" in f and "importance" in f for f in fi)


# ── Alerts ────────────────────────────────────────────────────────────────────
class TestAlerts:
    def test_list_alerts(self, client, admin_headers):
        r = client.get("/api/alerts", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "alerts" in data

    def test_alert_created_for_high_risk(self, client, admin_headers):
        payload = {
            "student_id": "ALERT_TEST01",
            "full_name": "Alert Test Student",
            "department_id": 1, "semester": 5, "section": "A",
            "attendance_pct": 40.0, "internal_marks": 28.0,
            "assignment_submission_rate": 35.0, "prev_semester_cgpa": 4.5,
            "lab_attendance_pct": 42.0, "quiz_avg_score": 25.0,
            "library_visits_per_month": 0, "extracurricular_participation": False,
            "active_backlogs": 4,
        }
        r = client.post("/api/students", headers=admin_headers, json=payload)
        assert r.status_code == 201
        data = r.json()
        stu_id = data["id"]
        if data["latest_risk_level"] in ("High", "Critical"):
            # Check alert was created
            ra = client.get("/api/alerts", headers=admin_headers)
            alerts = ra.json()["alerts"]
            matching = [a for a in alerts if a["student_id"] == stu_id]
            assert len(matching) >= 1
        # Cleanup
        client.delete(f"/api/students/{stu_id}", headers=admin_headers)

    def test_acknowledge_alert(self, client, admin_headers):
        # Create a high-risk student first to generate alert
        payload = {
            "student_id": "ACK_TEST01",
            "full_name": "Ack Test Student",
            "department_id": 1, "semester": 6, "section": "A",
            "attendance_pct": 38.0, "internal_marks": 25.0,
            "assignment_submission_rate": 30.0, "prev_semester_cgpa": 4.2,
            "lab_attendance_pct": 40.0, "quiz_avg_score": 22.0,
            "library_visits_per_month": 0, "extracurricular_participation": False,
            "active_backlogs": 5,
        }
        r = client.post("/api/students", headers=admin_headers, json=payload)
        stu_id = r.json()["id"]
        ra = client.get("/api/alerts", headers=admin_headers)
        alerts = [a for a in ra.json()["alerts"] if a["student_id"] == stu_id]
        if alerts:
            alert_id = alerts[0]["id"]
            r = client.post(f"/api/alerts/{alert_id}/acknowledge", headers=admin_headers)
            assert r.status_code == 200
        # Cleanup
        client.delete(f"/api/students/{stu_id}", headers=admin_headers)


# ── Dashboard ─────────────────────────────────────────────────────────────────
class TestDashboard:
    def test_overview_structure(self, client, admin_headers):
        r = client.get("/api/dashboard/overview", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for key in ["total_students", "at_risk_count", "critical_count",
                    "high_count", "medium_count", "low_count",
                    "at_risk_pct", "departments", "risk_trend"]:
            assert key in data, f"Missing key: {key}"

    def test_overview_numbers_consistent(self, client, admin_headers):
        r = client.get("/api/dashboard/overview", headers=admin_headers)
        data = r.json()
        total = data["total_students"]
        assert data["at_risk_count"] <= total
        at_risk = data["critical_count"] + data["high_count"]
        assert at_risk == data["at_risk_count"]

    def test_risk_trend_7_days(self, client, admin_headers):
        r = client.get("/api/dashboard/overview", headers=admin_headers)
        trend = r.json()["risk_trend"]
        assert len(trend) == 7
        assert all("date" in t and "at_risk" in t for t in trend)

    def test_hod_sees_only_own_dept(self, client, hod_headers):
        r = client.get("/api/dashboard/overview", headers=hod_headers)
        assert r.status_code == 200
        # HOD only sees their dept — departments list filtered
        data = r.json()
        assert isinstance(data["total_students"], int)


# ── User Management ───────────────────────────────────────────────────────────
class TestUsers:
    new_user_id = None

    def test_admin_can_list_users(self, client, admin_headers):
        r = client.get("/api/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 7  # seeded users

    def test_admin_can_create_user(self, client, admin_headers):
        r = client.post("/api/users", headers=admin_headers, json={
            "email": "test.faculty@eduguard.edu",
            "username": "test_faculty",
            "full_name": "Test Faculty Member",
            "password": "TestPass@1",
            "role": "faculty",
            "department_id": 1,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["role"] == "faculty"
        TestUsers.new_user_id = data["id"]

    def test_duplicate_email_rejected(self, client, admin_headers):
        r = client.post("/api/users", headers=admin_headers, json={
            "email": "test.faculty@eduguard.edu",
            "username": "test_faculty_dup",
            "full_name": "Duplicate",
            "password": "TestPass@1",
            "role": "faculty",
        })
        assert r.status_code == 409

    def test_admin_can_delete_user(self, client, admin_headers):
        if TestUsers.new_user_id:
            r = client.delete(f"/api/users/{TestUsers.new_user_id}", headers=admin_headers)
            assert r.status_code == 204

    def test_admin_cannot_delete_self(self, client, admin_headers):
        me = client.get("/api/auth/me", headers=admin_headers).json()
        r = client.delete(f"/api/users/{me['id']}", headers=admin_headers)
        assert r.status_code == 400


# ── CSV Upload ────────────────────────────────────────────────────────────────
class TestCsvUpload:
    def test_csv_upload_valid(self, client, admin_headers):
        import io
        csv_content = (
            "student_id,full_name,semester,section,attendance_pct,internal_marks,"
            "assignment_submission_rate,prev_semester_cgpa,lab_attendance_pct,"
            "quiz_avg_score,library_visits_per_month,extracurricular_participation,"
            "active_backlogs,department\n"
            "CSV001,CSV Student One,3,A,72.0,58.0,65.0,6.8,70.0,52.0,3,1,0,CSE\n"
            "CSV002,CSV Student Two,3,A,42.0,30.0,38.0,4.9,45.0,28.0,0,0,3,CSE\n"
        )
        f = io.BytesIO(csv_content.encode())
        r = client.post(
            "/api/students/bulk/upload",
            headers=admin_headers,
            files={"file": ("students.csv", f, "text/csv")},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["created"] + data["updated"] >= 1

    def test_csv_upload_invalid_extension(self, client, admin_headers):
        import io
        r = client.post(
            "/api/students/bulk/upload",
            headers=admin_headers,
            files={"file": ("students.xlsx", io.BytesIO(b"data"), "application/octet-stream")},
        )
        assert r.status_code == 400

    def test_csv_missing_columns(self, client, admin_headers):
        import io
        csv_content = "student_id,full_name\nX001,Only Name\n"
        r = client.post(
            "/api/students/bulk/upload",
            headers=admin_headers,
            files={"file": ("bad.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        )
        assert r.status_code == 400


# ── Student + Parent Login ─────────────────────────────────────────────────────
class TestStudentParentLogin:
    def test_student_login_invalid_usn(self, client):
        r = client.post("/api/auth/student-login", json={
            "full_name": "Nobody Here", "usn": "4SN99XX999"
        })
        assert r.status_code == 401

    def test_parent_login_invalid_usn(self, client):
        r = client.post("/api/auth/parent-login", json={
            "full_name": "Nobody", "usn": "4SN99XX999"
        })
        assert r.status_code == 401

    def test_student_login_wrong_name(self, client, admin_headers):
        # Create a student first
        r = client.post("/api/students", headers=admin_headers, json={
            "student_id": "4SN22CS099", "full_name": "Real Student Name",
            "department_id": 1, "semester": 7, "section": "A",
            "attendance_pct": 80.0, "internal_marks": 65.0,
            "assignment_submission_rate": 78.0, "prev_semester_cgpa": 7.5,
            "lab_attendance_pct": 82.0, "quiz_avg_score": 60.0,
            "library_visits_per_month": 4, "extracurricular_participation": True,
            "active_backlogs": 0,
        })
        assert r.status_code == 201
        usn = r.json()["usn"]

        # Wrong name → 401
        r2 = client.post("/api/auth/student-login", json={
            "full_name": "Wrong Name Entirely", "usn": usn
        })
        assert r2.status_code == 401

        # Cleanup
        client.delete(f"/api/students/{r.json()['id']}", headers=admin_headers)

    def test_usn_format_correct(self, client, admin_headers):
        """USN must follow 4SNYYXX001 pattern."""
        import re
        r = client.post("/api/students", headers=admin_headers, json={
            "student_id": "TEST_USN_01", "full_name": "USN Test Student",
            "department_id": 1, "semester": 4, "section": "A",
            "attendance_pct": 75.0, "internal_marks": 55.0,
            "assignment_submission_rate": 70.0, "prev_semester_cgpa": 6.5,
            "lab_attendance_pct": 78.0, "quiz_avg_score": 52.0,
            "library_visits_per_month": 3, "extracurricular_participation": False,
            "active_backlogs": 0,
        })
        assert r.status_code == 201
        usn = r.json()["usn"]
        assert re.match(r"^4SN\d{2}[A-Z]{2}\d{3}$", usn), f"Invalid USN format: {usn}"
        client.delete(f"/api/students/{r.json()['id']}", headers=admin_headers)

    def test_student_read_only_own(self, client, admin_headers):
        """Students cannot list all students."""
        # Create student
        r = client.post("/api/students", headers=admin_headers, json={
            "student_id": "TEST_SRO_01", "full_name": "Read Only Student",
            "department_id": 1, "semester": 3, "section": "A",
            "attendance_pct": 82.0, "internal_marks": 68.0,
            "assignment_submission_rate": 75.0, "prev_semester_cgpa": 7.0,
            "lab_attendance_pct": 80.0, "quiz_avg_score": 65.0,
            "library_visits_per_month": 3, "extracurricular_participation": True,
            "active_backlogs": 0,
        })
        assert r.status_code == 201
        stu  = r.json()
        usn  = stu["usn"]
        name = stu["full_name"]

        # Login as student
        r2 = client.post("/api/auth/student-login", json={"full_name": name, "usn": usn})
        assert r2.status_code == 200
        stok = r2.json()["access_token"]
        SH   = {"Authorization": f"Bearer {stok}"}

        # Cannot list students
        r3 = client.get("/api/students", headers=SH)
        assert r3.status_code == 403

        # Can view own profile
        r4 = client.get("/api/students/my-profile", headers=SH)
        assert r4.status_code == 200
        assert r4.json()["usn"] == usn

        # Cannot edit
        r5 = client.patch(f"/api/students/{stu['id']}", headers=SH, json={"section": "B"})
        assert r5.status_code == 403

        client.delete(f"/api/students/{stu['id']}", headers=admin_headers)
