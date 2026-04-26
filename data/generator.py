"""
Synthetic student dataset generator — EduGuard v2.1
USN format: 4SNYYXX001 (YY=batch year, XX=dept code, 001=serial)
Departments: CS, IS, EC, EE, ME, CG
"""
import numpy as np
import pandas as pd
import random

DEPARTMENTS = {
    "CS": "Computer Science",
    "IS": "Information Science",
    "EC": "Electronics and Communication",
    "EE": "Electrical Engineering",
    "ME": "Mechanical Engineering",
    "CG": "Computer Science and Design",
}

# Semester → batch year mapping (2026 academic year)
SEM_TO_BATCH = {1: 25, 2: 25, 3: 24, 4: 24, 5: 23, 6: 23, 7: 22, 8: 22}

FIRST_NAMES = [
    "Arjun","Priya","Rahul","Sneha","Kiran","Deepa","Anil","Kavya",
    "Suresh","Lakshmi","Vijay","Meera","Ravi","Divya","Mohan","Pooja",
    "Sanjay","Nisha","Ramesh","Ananya","Ganesh","Shruti","Vinod","Swathi",
    "Harish","Bhavana","Manoj","Rekha","Girish","Pavithra","Naveen","Sowmya",
    "Santosh","Rashmi","Prasad","Varsha","Sunil","Archana","Dinesh","Smitha",
    "Ashok","Shilpa","Raju","Mamatha","Lokesh","Chaitra","Shivu","Yashoda",
]
LAST_NAMES = [
    "Kumar","Sharma","Reddy","Naik","Gowda","Rao","Patil","Hegde",
    "Nair","Menon","Pillai","Iyer","Krishnan","Subramaniam","Pandey",
    "Singh","Patel","Shah","Joshi","Verma","Gupta","Mishra","Tiwari",
    "Shetty","Bhat","Kamath","Prabhu","Salian","Poojary","Bangera",
]

_counters: dict = {}

def _usn(dept_code: str, semester: int) -> str:
    yy  = SEM_TO_BATCH.get(semester, 22)
    key = f"{yy}{dept_code}"
    _counters[key] = _counters.get(key, 0) + 1
    return f"4SN{yy}{dept_code}{_counters[key]:03d}"


def generate_student_data(n: int = 1200, at_risk_ratio: float = 0.18,
                          seed: int = 42) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)
    _counters.clear()

    dept_codes = list(DEPARTMENTS.keys())
    n_at_risk  = int(n * at_risk_ratio)
    n_safe     = n - n_at_risk
    data       = []

    def _name():
        return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

    def gen(at_risk: bool):
        dept = random.choice(dept_codes)
        sem  = random.randint(1, 8)
        usn  = _usn(dept, sem)
        name = _name()
        batch_yy = SEM_TO_BATCH.get(sem, 22)

        if at_risk:
            att  = np.clip(np.random.normal(55, 12), 10, 74)
            im   = np.clip(np.random.normal(38, 10), 5, 59)
            ar   = np.clip(np.random.normal(45, 18), 0, 79)
            cgpa = np.clip(np.random.normal(5.2, 1.0), 2.0, 7.5)
            lab  = np.clip(att + np.random.normal(0, 8), 10, 85)
            qz   = np.clip(np.random.normal(35, 12), 0, 59)
            lib  = int(np.clip(np.random.poisson(1), 0, 5))
            ec   = random.choices([0, 1], [0.6, 0.4])[0]
            bl   = int(np.clip(np.random.poisson(2.5), 0, 8))
        else:
            att  = np.clip(np.random.normal(82, 9), 60, 100)
            im   = np.clip(np.random.normal(68, 10), 40, 100)
            ar   = np.clip(np.random.normal(82, 12), 50, 100)
            cgpa = np.clip(np.random.normal(7.8, 0.9), 5.5, 10.0)
            lab  = np.clip(att + np.random.normal(2, 5), 55, 100)
            qz   = np.clip(np.random.normal(65, 12), 35, 100)
            lib  = int(np.clip(np.random.poisson(4), 0, 15))
            ec   = random.choices([0, 1], [0.4, 0.6])[0]
            bl   = int(np.clip(np.random.poisson(0.3), 0, 3))

        return {
            "student_id":  usn,
            "usn":         usn,
            "full_name":   name,
            "department":  dept,
            "semester":    sem,
            "batch_year":  2000 + batch_yy,
            "email":       f"{name.lower().replace(' ','.')}.{usn.lower()}@college.edu",
            "parent_email": f"parent.{usn.lower()}@gmail.com",
            "attendance_pct":             round(att,  2),
            "internal_marks":             round(im,   2),
            "assignment_submission_rate": round(ar,   2),
            "prev_semester_cgpa":         round(cgpa, 2),
            "lab_attendance_pct":         round(lab,  2),
            "quiz_avg_score":             round(qz,   2),
            "library_visits_per_month":   lib,
            "extracurricular_participation": ec,
            "active_backlogs":            bl,
            "at_risk":                    int(at_risk),
        }

    for _ in range(n_at_risk): data.append(gen(True))
    for _ in range(n_safe):    data.append(gen(False))

    df = pd.DataFrame(data).sample(frac=1, random_state=seed).reset_index(drop=True)
    return df
