"""
Tests for Student Risk Prediction System
Run: pytest tests/ -v
"""

import pytest
import sys
import os
import pandas as pd
import numpy as np
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope='module')
def sample_student():
    return {
        'student_id': 'TEST001',
        'department': 'CSE',
        'semester': 4,
        'attendance_pct': 55.0,
        'internal_marks': 38.0,
        'assignment_submission_rate': 42.0,
        'prev_semester_cgpa': 5.2,
        'lab_attendance_pct': 58.0,
        'quiz_avg_score': 33.0,
        'library_visits_per_month': 1,
        'extracurricular_participation': 0,
        'active_backlogs': 3
    }

@pytest.fixture(scope='module')
def safe_student():
    return {
        'student_id': 'TEST002',
        'department': 'ECE',
        'semester': 3,
        'attendance_pct': 90.0,
        'internal_marks': 78.0,
        'assignment_submission_rate': 92.0,
        'prev_semester_cgpa': 8.5,
        'lab_attendance_pct': 88.0,
        'quiz_avg_score': 74.0,
        'library_visits_per_month': 7,
        'extracurricular_participation': 1,
        'active_backlogs': 0
    }

@pytest.fixture(scope='module')
def pipeline():
    import joblib
    path = os.path.join(os.path.dirname(__file__), '../models/risk_pipeline.pkl')
    if not os.path.exists(path):
        pytest.skip("Model not trained yet. Run: python models/train.py")
    return joblib.load(path)

@pytest.fixture(scope='module')
def le_dept():
    import joblib
    path = os.path.join(os.path.dirname(__file__), '../models/le_dept.pkl')
    return joblib.load(path)

@pytest.fixture(scope='module')
def metrics():
    path = os.path.join(os.path.dirname(__file__), '../models/metrics.json')
    with open(path) as f:
        return json.load(f)


# ── Data Tests ────────────────────────────────────────────────────────────────
class TestDataGeneration:
    def test_dataset_exists(self):
        path = os.path.join(os.path.dirname(__file__), '../data/students.csv')
        assert os.path.exists(path), "Run: python data/generate_dataset.py"

    def test_dataset_shape(self):
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        assert df.shape[0] >= 1000, "Dataset should have 1000+ students"
        assert df.shape[1] >= 12, "Dataset should have 12+ features"

    def test_imbalance_ratio(self):
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        ratio = df['at_risk'].mean()
        assert 0.10 <= ratio <= 0.30, f"Expected 10-30% at-risk, got {ratio:.2%}"

    def test_no_nulls(self):
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        assert df.isnull().sum().sum() == 0, "Dataset should have no nulls"

    def test_value_ranges(self):
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        assert df['attendance_pct'].between(0, 100).all()
        assert df['internal_marks'].between(0, 100).all()
        assert df['prev_semester_cgpa'].between(0, 10).all()
        assert df['semester'].between(1, 8).all()


# ── Model Tests ───────────────────────────────────────────────────────────────
class TestModel:
    def test_model_artifacts_exist(self):
        model_dir = os.path.join(os.path.dirname(__file__), '../models')
        for fname in ['risk_pipeline.pkl', 'shap_explainer.pkl', 'metrics.json',
                      'feature_importance.csv', 'predictions.csv']:
            assert os.path.exists(os.path.join(model_dir, fname)), f"Missing: {fname}"

    def test_model_f1_target(self, metrics):
        assert metrics['f1_cv'] >= 0.78, f"F1={metrics['f1_cv']:.4f} — below 0.78 target"

    def test_model_auc_roc(self, metrics):
        assert metrics['auc_roc_cv'] >= 0.85, f"AUC-ROC={metrics['auc_roc_cv']:.4f} too low"

    def test_predict_at_risk_student(self, pipeline, le_dept, metrics):
        df = pd.DataFrame([{
            'attendance_pct': 50.0, 'internal_marks': 32.0,
            'assignment_submission_rate': 38.0, 'prev_semester_cgpa': 4.8,
            'lab_attendance_pct': 52.0, 'quiz_avg_score': 28.0,
            'library_visits_per_month': 0, 'extracurricular_participation': 0,
            'active_backlogs': 4, 'dept_enc': 0, 'semester': 5
        }])
        proba = pipeline.predict_proba(df[metrics['feature_names']])[0, 1]
        assert proba > 0.5, f"Clear at-risk student should have proba > 0.5, got {proba:.3f}"

    def test_predict_safe_student(self, pipeline, le_dept, metrics):
        df = pd.DataFrame([{
            'attendance_pct': 92.0, 'internal_marks': 82.0,
            'assignment_submission_rate': 95.0, 'prev_semester_cgpa': 9.0,
            'lab_attendance_pct': 90.0, 'quiz_avg_score': 78.0,
            'library_visits_per_month': 8, 'extracurricular_participation': 1,
            'active_backlogs': 0, 'dept_enc': 1, 'semester': 3
        }])
        proba = pipeline.predict_proba(df[metrics['feature_names']])[0, 1]
        assert proba < 0.5, f"Clear safe student should have proba < 0.5, got {proba:.3f}"

    def test_output_probabilities_in_range(self, pipeline, metrics):
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        import joblib
        le = joblib.load(os.path.join(os.path.dirname(__file__), '../models/le_dept.pkl'))
        df['dept_enc'] = le.transform(df['department'])
        X = df[metrics['feature_names']]
        proba = pipeline.predict_proba(X)[:, 1]
        assert (proba >= 0).all() and (proba <= 1).all(), "Probabilities must be in [0, 1]"

    def test_shap_values_shape(self, metrics):
        import joblib
        import shap
        model_dir = os.path.join(os.path.dirname(__file__), '../models')
        explainer = joblib.load(os.path.join(model_dir, 'shap_explainer.pkl'))
        le = joblib.load(os.path.join(model_dir, 'le_dept.pkl'))
        pipeline = joblib.load(os.path.join(model_dir, 'risk_pipeline.pkl'))

        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv')).head(10)
        df['dept_enc'] = le.transform(df['department'])
        X = df[metrics['feature_names']]
        sv = explainer.shap_values(X)
        assert sv.shape == (10, len(metrics['feature_names'])), "SHAP values shape mismatch"


# ── Utils Tests ───────────────────────────────────────────────────────────────
class TestUtils:
    def test_risk_label_mapping(self):
        from utils.helpers import risk_label_from_proba
        assert risk_label_from_proba(0.1) == 'Low'
        assert risk_label_from_proba(0.4) == 'Medium'
        assert risk_label_from_proba(0.65) == 'High'
        assert risk_label_from_proba(0.9) == 'Critical'

    def test_csv_schema_validation(self):
        from utils.helpers import validate_csv_schema
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), '../data/students.csv'))
        valid, missing = validate_csv_schema(df)
        assert valid, f"Schema validation failed: {missing}"

        bad_df = pd.DataFrame({'student_id': [1], 'attendance_pct': [70]})
        valid2, missing2 = validate_csv_schema(bad_df)
        assert not valid2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
