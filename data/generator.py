"""Synthetic student dataset generator."""
import numpy as np
import pandas as pd
import random

def generate_student_data(n=1200, at_risk_ratio=0.18):
    random.seed(42); np.random.seed(42)
    depts = ['CSE','ISE','AIML','ECE','EEE','MECH','CIVIL']
    n_at_risk = int(n * at_risk_ratio)
    n_safe = n - n_at_risk
    data = []

    def gen(at_risk):
        d = random.choice(depts); sem = random.randint(1, 8)
        if at_risk:
            att = np.clip(np.random.normal(55,12),10,74)
            im  = np.clip(np.random.normal(38,10),5,59)
            ar  = np.clip(np.random.normal(45,18),0,79)
            cgpa= np.clip(np.random.normal(5.2,1.0),2.0,7.5)
            lab = np.clip(att+np.random.normal(0,8),10,85)
            qz  = np.clip(np.random.normal(35,12),0,59)
            lib = int(np.clip(np.random.poisson(1),0,5))
            ec  = random.choices([0,1],[0.6,0.4])[0]
            bl  = int(np.clip(np.random.poisson(2.5),0,8))
        else:
            att = np.clip(np.random.normal(82,9),60,100)
            im  = np.clip(np.random.normal(68,10),40,100)
            ar  = np.clip(np.random.normal(82,12),50,100)
            cgpa= np.clip(np.random.normal(7.8,0.9),5.5,10.0)
            lab = np.clip(att+np.random.normal(2,5),55,100)
            qz  = np.clip(np.random.normal(65,12),35,100)
            lib = int(np.clip(np.random.poisson(4),0,15))
            ec  = random.choices([0,1],[0.4,0.6])[0]
            bl  = int(np.clip(np.random.poisson(0.3),0,3))
        return {
            'student_id': f"STU{random.randint(10000,99999)}",
            'full_name': f"Student {random.randint(1000,9999)}",
            'department': d, 'semester': sem,
            'attendance_pct': round(att,2), 'internal_marks': round(im,2),
            'assignment_submission_rate': round(ar,2), 'prev_semester_cgpa': round(cgpa,2),
            'lab_attendance_pct': round(lab,2), 'quiz_avg_score': round(qz,2),
            'library_visits_per_month': lib, 'extracurricular_participation': ec,
            'active_backlogs': bl, 'at_risk': int(at_risk),
        }

    for _ in range(n_at_risk): data.append(gen(True))
    for _ in range(n_safe):    data.append(gen(False))
    return pd.DataFrame(data).sample(frac=1, random_state=42).reset_index(drop=True)
