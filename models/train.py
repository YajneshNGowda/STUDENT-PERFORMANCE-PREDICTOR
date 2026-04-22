"""
Student Risk Prediction - ML Training Pipeline
- Handles class imbalance via SMOTE + class weights
- XGBoost classifier with threshold tuning
- Full SHAP explainability
- Saves model artifacts for backend use
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
import joblib
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    f1_score, roc_auc_score, precision_recall_curve,
    classification_report, confusion_matrix, average_precision_score
)
from sklearn.pipeline import Pipeline
from sklearn.ensemble import GradientBoostingClassifier
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

warnings.filterwarnings('ignore')

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '../data/students.csv')
MODEL_DIR = os.path.join(BASE_DIR, '../models')
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    'attendance_pct', 'internal_marks', 'assignment_submission_rate',
    'prev_semester_cgpa', 'lab_attendance_pct', 'quiz_avg_score',
    'library_visits_per_month', 'extracurricular_participation', 'active_backlogs'
]
CAT_COLS = ['department', 'semester']
TARGET = 'at_risk'


# ── Data Loading & Preprocessing ─────────────────────────────────────────────
def load_and_preprocess(path=DATA_PATH):
    df = pd.read_csv(path)

    # Encode categoricals
    le_dept = LabelEncoder()
    df['dept_enc'] = le_dept.fit_transform(df['department'])
    joblib.dump(le_dept, os.path.join(MODEL_DIR, 'le_dept.pkl'))

    feature_cols_full = FEATURE_COLS + ['dept_enc', 'semester']
    X = df[feature_cols_full].copy()
    y = df[TARGET].copy()

    return df, X, y, feature_cols_full


# ── Model Training ────────────────────────────────────────────────────────────
def train_model(X, y):
    print(f"\n{'='*60}")
    print("  STUDENT RISK PREDICTOR — TRAINING PIPELINE")
    print(f"{'='*60}")
    print(f"  Dataset shape : {X.shape}")
    print(f"  Class balance : {y.value_counts().to_dict()}")
    print(f"  At-risk ratio : {y.mean():.2%}\n")

    # SMOTE + XGBoost pipeline
    scale_pos_weight = (y == 0).sum() / (y == 1).sum()

    xgb = XGBClassifier(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42,
        n_jobs=-1
    )

    smote = SMOTE(sampling_strategy=0.5, random_state=42, k_neighbors=5)

    pipeline = ImbPipeline([
        ('smote', smote),
        ('model', xgb)
    ])

    # Stratified K-Fold cross-validation
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_probs = cross_val_predict(pipeline, X, y, cv=skf, method='predict_proba')[:, 1]

    # Threshold tuning for best F1
    thresholds = np.arange(0.2, 0.8, 0.01)
    f1_scores = [f1_score(y, (cv_probs >= t).astype(int)) for t in thresholds]
    best_threshold = thresholds[np.argmax(f1_scores)]
    best_f1 = max(f1_scores)

    print(f"  CV Best Threshold : {best_threshold:.2f}")
    print(f"  CV Best F1        : {best_f1:.4f}")
    print(f"  CV AUC-ROC        : {roc_auc_score(y, cv_probs):.4f}")
    print(f"  CV Avg Precision  : {average_precision_score(y, cv_probs):.4f}\n")

    # Final fit on full data
    pipeline.fit(X, y)
    final_model = pipeline.named_steps['model']

    # Metrics on full data (for reporting)
    full_probs = pipeline.predict_proba(X)[:, 1]
    full_preds = (full_probs >= best_threshold).astype(int)

    print("  Classification Report (full data):")
    print(classification_report(y, full_preds, target_names=['Safe', 'At-Risk']))

    metrics = {
        'f1_cv': float(best_f1),
        'auc_roc_cv': float(roc_auc_score(y, cv_probs)),
        'avg_precision_cv': float(average_precision_score(y, cv_probs)),
        'best_threshold': float(best_threshold),
        'n_samples': int(len(y)),
        'n_at_risk': int(y.sum()),
        'feature_names': list(X.columns)
    }

    return pipeline, final_model, cv_probs, best_threshold, metrics


# ── SHAP Explainability ───────────────────────────────────────────────────────
def compute_shap(final_model, X, feature_names):
    print("  Computing SHAP values...")
    explainer = shap.TreeExplainer(final_model)
    shap_values = explainer.shap_values(X)

    # Global feature importance
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'mean_abs_shap': mean_abs_shap
    }).sort_values('mean_abs_shap', ascending=False)

    print("\n  SHAP Feature Importance:")
    for _, row in importance_df.iterrows():
        bar = '█' * int(row['mean_abs_shap'] * 40)
        print(f"    {row['feature']:35s} {bar} {row['mean_abs_shap']:.4f}")

    # Save SHAP summary plot
    plt.figure(figsize=(10, 7))
    shap.summary_plot(shap_values, X, feature_names=feature_names,
                      show=False, plot_type='bar')
    plt.title('SHAP Feature Importance — Student Risk Predictor', fontsize=14, pad=15)
    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_DIR, 'shap_summary.png'), dpi=150, bbox_inches='tight')
    plt.close()

    # Beeswarm plot
    plt.figure(figsize=(10, 7))
    shap.summary_plot(shap_values, X, feature_names=feature_names, show=False)
    plt.title('SHAP Beeswarm — Feature Impact Distribution', fontsize=14, pad=15)
    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_DIR, 'shap_beeswarm.png'), dpi=150, bbox_inches='tight')
    plt.close()

    return explainer, shap_values, importance_df


# ── EDA Plots ─────────────────────────────────────────────────────────────────
def generate_eda_plots(df):
    print("\n  Generating EDA plots...")
    fig, axes = plt.subplots(2, 3, figsize=(16, 10))
    fig.suptitle('EDA — Student Performance Features vs Risk', fontsize=16, fontweight='bold')

    features = ['attendance_pct', 'internal_marks', 'assignment_submission_rate',
                'prev_semester_cgpa', 'quiz_avg_score', 'active_backlogs']
    titles = ['Attendance %', 'Internal Marks', 'Assignment Rate',
              'Prev CGPA', 'Quiz Avg', 'Active Backlogs']
    colors = ['#2196F3', '#4CAF50']

    for ax, feat, title in zip(axes.flat, features, titles):
        for label, color in zip([0, 1], colors):
            subset = df[df['at_risk'] == label][feat]
            ax.hist(subset, bins=25, alpha=0.65, color=color,
                    label='Safe' if label == 0 else 'At-Risk', density=True)
        ax.set_title(title, fontweight='bold')
        ax.legend()
        ax.set_xlabel(feat)
        ax.set_ylabel('Density')

    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_DIR, 'eda_distributions.png'), dpi=150, bbox_inches='tight')
    plt.close()

    # Correlation heatmap
    plt.figure(figsize=(11, 9))
    corr = df[FEATURE_COLS + [TARGET]].corr()
    mask = np.triu(np.ones_like(corr, dtype=bool))
    sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdYlGn',
                center=0, square=True, linewidths=0.5, cbar_kws={'shrink': 0.8})
    plt.title('Feature Correlation Matrix', fontsize=14, fontweight='bold', pad=15)
    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_DIR, 'correlation_heatmap.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("  EDA plots saved.\n")


# ── Save Artifacts ────────────────────────────────────────────────────────────
def save_artifacts(pipeline, explainer, metrics, importance_df, df, X, shap_values):
    joblib.dump(pipeline, os.path.join(MODEL_DIR, 'risk_pipeline.pkl'))
    joblib.dump(explainer, os.path.join(MODEL_DIR, 'shap_explainer.pkl'))

    with open(os.path.join(MODEL_DIR, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    importance_df.to_csv(os.path.join(MODEL_DIR, 'feature_importance.csv'), index=False)

    # Per-student SHAP for top features — save for dashboard
    shap_df = pd.DataFrame(shap_values, columns=metrics['feature_names'])
    shap_df.insert(0, 'student_id', df['student_id'].values)
    shap_df.to_csv(os.path.join(MODEL_DIR, 'shap_per_student.csv'), index=False)

    # Final predictions CSV
    proba = pipeline.predict_proba(X)[:, 1]
    preds = (proba >= metrics['best_threshold']).astype(int)
    result_df = df[['student_id', 'department', 'semester', 'attendance_pct',
                    'internal_marks', 'prev_semester_cgpa', 'at_risk']].copy()
    result_df['risk_probability'] = proba.round(4)
    result_df['predicted_at_risk'] = preds
    result_df['risk_level'] = pd.cut(
        proba,
        bins=[0, 0.3, 0.55, 0.75, 1.0],
        labels=['Low', 'Medium', 'High', 'Critical']
    )
    result_df.to_csv(os.path.join(MODEL_DIR, 'predictions.csv'), index=False)

    print(f"\n  Artifacts saved to: {MODEL_DIR}/")
    print(f"  ✅ Model          : risk_pipeline.pkl")
    print(f"  ✅ SHAP Explainer : shap_explainer.pkl")
    print(f"  ✅ Metrics        : metrics.json")
    print(f"  ✅ Predictions    : predictions.csv")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    df, X, y, feature_cols = load_and_preprocess()
    generate_eda_plots(df)
    pipeline, final_model, cv_probs, best_threshold, metrics = train_model(X, y)
    explainer, shap_values, importance_df = compute_shap(final_model, X, feature_cols)
    save_artifacts(pipeline, explainer, metrics, importance_df, df, X, shap_values)

    print(f"\n{'='*60}")
    print(f"  TRAINING COMPLETE")
    print(f"  F1 Score  : {metrics['f1_cv']:.4f}  {'✅ PASS' if metrics['f1_cv'] >= 0.78 else '⚠️  Below target'}")
    print(f"  AUC-ROC   : {metrics['auc_roc_cv']:.4f}")
    print(f"  Avg Prec  : {metrics['avg_precision_cv']:.4f}")
    print(f"{'='*60}\n")
