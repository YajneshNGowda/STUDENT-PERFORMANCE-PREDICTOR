"""
Utility functions shared across the project.
"""

import os
import pandas as pd
import numpy as np
import joblib
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, 'models')


def load_pipeline():
    return joblib.load(os.path.join(MODEL_DIR, 'risk_pipeline.pkl'))


def load_explainer():
    return joblib.load(os.path.join(MODEL_DIR, 'shap_explainer.pkl'))


def load_label_encoder():
    return joblib.load(os.path.join(MODEL_DIR, 'le_dept.pkl'))


def load_metrics():
    with open(os.path.join(MODEL_DIR, 'metrics.json')) as f:
        return json.load(f)


def preprocess_input(df: pd.DataFrame, le_dept, feature_cols):
    """Encode department and align feature columns."""
    df = df.copy()
    known_depts = list(le_dept.classes_)
    df['department'] = df['department'].apply(
        lambda x: x if x in known_depts else known_depts[0]
    )
    df['dept_enc'] = le_dept.transform(df['department'])
    return df[feature_cols]


def risk_label_from_proba(proba: float) -> str:
    if proba < 0.30:
        return 'Low'
    elif proba < 0.55:
        return 'Medium'
    elif proba < 0.75:
        return 'High'
    else:
        return 'Critical'


def validate_csv_schema(df: pd.DataFrame) -> tuple[bool, list]:
    required = [
        'student_id', 'department', 'semester', 'attendance_pct',
        'internal_marks', 'assignment_submission_rate', 'prev_semester_cgpa',
        'lab_attendance_pct', 'quiz_avg_score', 'library_visits_per_month',
        'extracurricular_participation', 'active_backlogs'
    ]
    missing = [c for c in required if c not in df.columns]
    return len(missing) == 0, missing
