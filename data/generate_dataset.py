"""
Synthetic Student Performance Dataset Generator
Generates realistic, imbalanced data mimicking real engineering college patterns.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
import random
import os

random.seed(42)
np.random.seed(42)

N_STUDENTS = 1200

departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT']
semesters = [1, 2, 3, 4, 5, 6, 7, 8]

def generate_student_data(n=N_STUDENTS, at_risk_ratio=0.18):
    data = []

    n_at_risk = int(n * at_risk_ratio)
    n_safe = n - n_at_risk

    def gen_student(at_risk: bool):
        dept = random.choice(departments)
        sem = random.choice(semesters)

        if at_risk:
            attendance = np.clip(np.random.normal(55, 12), 10, 74)
            internal_marks = np.clip(np.random.normal(38, 10), 5, 59)
            assignment_rate = np.clip(np.random.normal(45, 18), 0, 79)
            prev_cgpa = np.clip(np.random.normal(5.2, 1.0), 2.0, 7.5)
            lab_attendance = np.clip(attendance + np.random.normal(0, 8), 10, 85)
            quiz_avg = np.clip(np.random.normal(35, 12), 0, 59)
            library_visits = int(np.clip(np.random.poisson(1), 0, 5))
            extracurricular = random.choices([0, 1], weights=[0.6, 0.4])[0]
            backlogs = int(np.clip(np.random.poisson(2.5), 0, 8))
        else:
            attendance = np.clip(np.random.normal(82, 9), 60, 100)
            internal_marks = np.clip(np.random.normal(68, 10), 40, 100)
            assignment_rate = np.clip(np.random.normal(82, 12), 50, 100)
            prev_cgpa = np.clip(np.random.normal(7.8, 0.9), 5.5, 10.0)
            lab_attendance = np.clip(attendance + np.random.normal(2, 5), 55, 100)
            quiz_avg = np.clip(np.random.normal(65, 12), 35, 100)
            library_visits = int(np.clip(np.random.poisson(4), 0, 15))
            extracurricular = random.choices([0, 1], weights=[0.4, 0.6])[0]
            backlogs = int(np.clip(np.random.poisson(0.3), 0, 3))

        # Add noise/outliers realistically
        if random.random() < 0.05:
            attendance = np.clip(attendance + np.random.normal(0, 15), 0, 100)

        mid_score = (
            0.35 * (attendance / 100) +
            0.40 * (internal_marks / 100) +
            0.15 * (assignment_rate / 100) +
            0.10 * (prev_cgpa / 10)
        ) + np.random.normal(0, 0.04)

        student_id = f"STU{random.randint(10000, 99999)}"

        return {
            'student_id': student_id,
            'department': dept,
            'semester': sem,
            'attendance_pct': round(attendance, 2),
            'internal_marks': round(internal_marks, 2),
            'assignment_submission_rate': round(assignment_rate, 2),
            'prev_semester_cgpa': round(prev_cgpa, 2),
            'lab_attendance_pct': round(lab_attendance, 2),
            'quiz_avg_score': round(quiz_avg, 2),
            'library_visits_per_month': library_visits,
            'extracurricular_participation': extracurricular,
            'active_backlogs': backlogs,
            'at_risk': int(at_risk),
        }

    for _ in range(n_at_risk):
        data.append(gen_student(at_risk=True))
    for _ in range(n_safe):
        data.append(gen_student(at_risk=False))

    df = pd.DataFrame(data)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = generate_student_data()
    out_path = os.path.join(os.path.dirname(__file__), 'students.csv')
    df.to_csv(out_path, index=False)
    print(f"Dataset saved to {out_path}")
    print(f"Shape: {df.shape}")
    print(f"At-risk ratio: {df['at_risk'].mean():.2%}")
    print(df.head())
