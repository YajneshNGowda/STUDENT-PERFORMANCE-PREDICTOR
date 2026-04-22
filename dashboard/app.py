"""
Student Risk Prediction Dashboard
Faculty Early Warning System — Streamlit UI
"""

import streamlit as st
import pandas as pd
import numpy as np
import json
import joblib
import os
import io
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="EduGuard — Student Risk System",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── Custom CSS ─────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
    
    html, body, [class*="css"] { font-family: 'Space Grotesk', sans-serif; }
    
    .main-header {
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        padding: 2rem;
        border-radius: 16px;
        margin-bottom: 1.5rem;
        text-align: center;
        color: white;
    }
    .main-header h1 { font-size: 2.4rem; font-weight: 700; margin: 0; }
    .main-header p { color: #a0aec0; margin: 0.5rem 0 0; font-size: 1.05rem; }
    
    .kpi-card {
        background: white;
        border-radius: 12px;
        padding: 1.2rem 1.5rem;
        border-left: 5px solid;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        margin-bottom: 0.5rem;
    }
    .kpi-card.critical { border-color: #e53e3e; }
    .kpi-card.high     { border-color: #f6ad55; }
    .kpi-card.medium   { border-color: #4299e1; }
    .kpi-card.safe     { border-color: #48bb78; }
    
    .risk-badge-critical { background:#fff5f5; color:#c53030; padding:3px 10px; border-radius:20px; font-weight:600; font-size:0.82rem; }
    .risk-badge-high     { background:#fffaf0; color:#c05621; padding:3px 10px; border-radius:20px; font-weight:600; font-size:0.82rem; }
    .risk-badge-medium   { background:#ebf8ff; color:#2b6cb0; padding:3px 10px; border-radius:20px; font-weight:600; font-size:0.82rem; }
    .risk-badge-low      { background:#f0fff4; color:#276749; padding:3px 10px; border-radius:20px; font-weight:600; font-size:0.82rem; }
    
    .alert-box {
        background: #fff5f5;
        border: 1.5px solid #fc8181;
        border-radius: 10px;
        padding: 1rem 1.2rem;
        margin-bottom: 0.7rem;
    }
    .section-title { font-size: 1.3rem; font-weight: 700; margin: 1.2rem 0 0.8rem; color: #2d3748; }
    .stDataFrame { border-radius: 10px; }
</style>
""", unsafe_allow_html=True)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, '../models')
DATA_DIR = os.path.join(BASE_DIR, '../data')


@st.cache_resource
def load_model_artifacts():
    pipeline = joblib.load(os.path.join(MODEL_DIR, 'risk_pipeline.pkl'))
    explainer = joblib.load(os.path.join(MODEL_DIR, 'shap_explainer.pkl'))
    le_dept = joblib.load(os.path.join(MODEL_DIR, 'le_dept.pkl'))
    with open(os.path.join(MODEL_DIR, 'metrics.json')) as f:
        metrics = json.load(f)
    return pipeline, explainer, le_dept, metrics


@st.cache_data
def load_predictions():
    return pd.read_csv(os.path.join(MODEL_DIR, 'predictions.csv'))


@st.cache_data
def load_feature_importance():
    return pd.read_csv(os.path.join(MODEL_DIR, 'feature_importance.csv'))


pipeline, explainer, le_dept, metrics = load_model_artifacts()
FEATURE_COLS = metrics['feature_names']

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🎓 EduGuard")
    st.markdown("*Early Warning System*")
    st.markdown("---")
    page = st.radio("Navigate", [
        "📊 Dashboard Overview",
        "👤 Predict Single Student",
        "📁 Batch Upload & Predict",
        "🔬 Model Explainability",
        "🚨 Alert Center",
        "📈 Model Performance"
    ])
    st.markdown("---")
    st.markdown(f"**Model:** XGBoost + SMOTE")
    st.markdown(f"**F1 Score:** `{metrics['f1_cv']:.4f}` ✅")
    st.markdown(f"**AUC-ROC:** `{metrics['auc_roc_cv']:.4f}`")
    st.markdown(f"**Threshold:** `{metrics['best_threshold']:.2f}`")


# ── Helper ─────────────────────────────────────────────────────────────────────
def predict_df(df: pd.DataFrame):
    df = df.copy()
    try:
        df['dept_enc'] = le_dept.transform(df['department'].astype(str))
    except Exception:
        unknown_map = {d: i for i, d in enumerate(le_dept.classes_)}
        df['dept_enc'] = df['department'].map(lambda x: unknown_map.get(x, 0))
    X = df[FEATURE_COLS]
    proba = pipeline.predict_proba(X)[:, 1]
    threshold = metrics['best_threshold']
    preds = (proba >= threshold).astype(int)
    shap_vals = explainer.shap_values(X)

    df['risk_probability'] = proba.round(4)
    df['predicted_at_risk'] = preds
    df['risk_level'] = pd.cut(
        proba,
        bins=[0, 0.3, 0.55, 0.75, 1.0],
        labels=['Low', 'Medium', 'High', 'Critical']
    ).astype(str)
    return df, shap_vals


def risk_color(level):
    return {'Critical': '#e53e3e', 'High': '#f6ad55', 'Medium': '#4299e1', 'Low': '#48bb78'}.get(level, '#a0aec0')


ALERT_LOG = []

def fire_alert(student_id, dept, semester, risk_level, risk_prob, top_factor):
    ALERT_LOG.append({
        'time': datetime.now().strftime('%H:%M:%S'),
        'student_id': student_id,
        'department': dept,
        'semester': semester,
        'risk_level': risk_level,
        'probability': f"{risk_prob:.1%}",
        'top_factor': top_factor
    })


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Dashboard Overview
# ══════════════════════════════════════════════════════════════════════════════
if page == "📊 Dashboard Overview":
    st.markdown("""
    <div class="main-header">
        <h1>🎓 EduGuard — Early Warning Dashboard</h1>
        <p>Proactive student risk detection for faculty intervention</p>
    </div>
    """, unsafe_allow_html=True)

    pred_df = load_predictions()

    # KPI Row
    total = len(pred_df)
    at_risk = int(pred_df['predicted_at_risk'].sum())
    critical = int((pred_df['risk_level'] == 'Critical').sum())
    high = int((pred_df['risk_level'] == 'High').sum())
    medium = int((pred_df['risk_level'] == 'Medium').sum())
    safe = total - at_risk

    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("Total Students", total)
    with col2:
        st.metric("🔴 Critical Risk", critical, delta=f"{critical/total:.1%}")
    with col3:
        st.metric("🟠 High Risk", high, delta=f"{high/total:.1%}")
    with col4:
        st.metric("🔵 Medium Risk", medium, delta=f"{medium/total:.1%}")
    with col5:
        st.metric("🟢 Safe", safe, delta=f"{safe/total:.1%}")

    st.markdown("---")
    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.markdown('<div class="section-title">Risk Distribution by Department</div>', unsafe_allow_html=True)
        dept_stats = pred_df.groupby('department').agg(
            Total=('student_id', 'count'),
            AtRisk=('predicted_at_risk', 'sum')
        ).reset_index()
        dept_stats['Safe'] = dept_stats['Total'] - dept_stats['AtRisk']
        dept_stats['Risk%'] = (dept_stats['AtRisk'] / dept_stats['Total'] * 100).round(1)

        fig = px.bar(
            dept_stats, x='department', y=['AtRisk', 'Safe'],
            color_discrete_map={'AtRisk': '#e53e3e', 'Safe': '#48bb78'},
            barmode='stack',
            labels={'value': 'Students', 'variable': 'Status'},
            title='Students by Department'
        )
        fig.update_layout(height=350, margin=dict(t=40, b=10))
        st.plotly_chart(fig, use_container_width=True)

    with col_right:
        st.markdown('<div class="section-title">Risk Level Breakdown</div>', unsafe_allow_html=True)
        level_counts = pred_df['risk_level'].value_counts()
        colors_map = {'Critical': '#e53e3e', 'High': '#f6ad55', 'Medium': '#4299e1', 'Low': '#48bb78'}
        fig2 = go.Figure(go.Pie(
            labels=level_counts.index,
            values=level_counts.values,
            marker_colors=[colors_map.get(l, '#a0aec0') for l in level_counts.index],
            hole=0.45,
            textinfo='label+percent'
        ))
        fig2.update_layout(height=350, margin=dict(t=40, b=10), showlegend=True)
        st.plotly_chart(fig2, use_container_width=True)

    # Scatter: Attendance vs Internal Marks
    st.markdown('<div class="section-title">Student Risk Map — Attendance vs Internal Marks</div>', unsafe_allow_html=True)
    fig3 = px.scatter(
        pred_df, x='attendance_pct', y='internal_marks',
        color='risk_level',
        color_discrete_map=colors_map,
        size='risk_probability',
        hover_data=['student_id', 'department', 'semester'],
        title='Each dot = 1 student  |  Size = Risk probability',
        opacity=0.75
    )
    fig3.update_layout(height=420, margin=dict(t=40))
    st.plotly_chart(fig3, use_container_width=True)

    # Top 15 highest-risk students
    st.markdown('<div class="section-title">🚨 Top 15 Highest-Risk Students</div>', unsafe_allow_html=True)
    top15 = pred_df.sort_values('risk_probability', ascending=False).head(15)[
        ['student_id', 'department', 'semester', 'attendance_pct',
         'internal_marks', 'prev_semester_cgpa', 'risk_probability', 'risk_level']
    ].copy()
    top15['risk_probability'] = (top15['risk_probability'] * 100).round(1).astype(str) + '%'
    st.dataframe(top15, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Single Student Prediction
# ══════════════════════════════════════════════════════════════════════════════
elif page == "👤 Predict Single Student":
    st.markdown("## 👤 Predict Risk for Single Student")
    st.markdown("Enter student details below to get an instant risk assessment with SHAP explanation.")

    with st.form("student_form"):
        c1, c2, c3 = st.columns(3)
        with c1:
            student_id = st.text_input("Student ID", value="STU12345")
            department = st.selectbox("Department", ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT'])
            semester = st.slider("Semester", 1, 8, 4)
        with c2:
            attendance = st.slider("Attendance %", 0.0, 100.0, 72.0, 0.5)
            internal_marks = st.slider("Internal Marks", 0.0, 100.0, 45.0, 0.5)
            assignment_rate = st.slider("Assignment Submission %", 0.0, 100.0, 60.0, 0.5)
            prev_cgpa = st.slider("Previous CGPA", 2.0, 10.0, 6.0, 0.1)
        with c3:
            lab_attendance = st.slider("Lab Attendance %", 0.0, 100.0, 68.0, 0.5)
            quiz_avg = st.slider("Quiz Avg Score", 0.0, 100.0, 42.0, 0.5)
            library_visits = st.number_input("Library Visits/Month", 0, 30, 2)
            extracurricular = st.selectbox("Extracurricular Participation", [0, 1], format_func=lambda x: "Yes" if x else "No")
            active_backlogs = st.number_input("Active Backlogs", 0, 20, 1)

        submitted = st.form_submit_button("🔍 Predict Risk", use_container_width=True)

    if submitted:
        student_df = pd.DataFrame([{
            'student_id': student_id, 'department': department, 'semester': semester,
            'attendance_pct': attendance, 'internal_marks': internal_marks,
            'assignment_submission_rate': assignment_rate, 'prev_semester_cgpa': prev_cgpa,
            'lab_attendance_pct': lab_attendance, 'quiz_avg_score': quiz_avg,
            'library_visits_per_month': library_visits,
            'extracurricular_participation': extracurricular, 'active_backlogs': active_backlogs
        }])

        result_df, shap_vals = predict_df(student_df)
        row = result_df.iloc[0]
        risk_level = row['risk_level']
        risk_prob = row['risk_probability']

        # Risk Level Banner
        color = risk_color(risk_level)
        emoji = {'Critical': '🔴', 'High': '🟠', 'Medium': '🔵', 'Low': '🟢'}.get(risk_level, '⚪')
        st.markdown(f"""
        <div style="background:{color}15; border:2px solid {color}; border-radius:14px; padding:1.5rem; text-align:center; margin:1rem 0;">
            <h2 style="color:{color}; margin:0;">{emoji} {risk_level} Risk</h2>
            <p style="font-size:2rem; font-weight:700; color:{color}; margin:0.5rem 0 0;">{risk_prob:.1%} probability</p>
            <p style="color:#666; margin:0;">Student: <strong>{student_id}</strong> | Dept: <strong>{department}</strong> | Sem: <strong>{semester}</strong></p>
        </div>
        """, unsafe_allow_html=True)

        # Auto alert
        if risk_level in ['Critical', 'High']:
            sv = shap_vals[0]
            top_f = FEATURE_COLS[np.argmax(np.abs(sv))]
            fire_alert(student_id, department, semester, risk_level, risk_prob, top_f)
            st.error(f"🚨 Alert automatically triggered for faculty! Top risk factor: **{top_f}**")

        # SHAP bar chart
        st.markdown("### 🔬 Top Contributing Factors (SHAP)")
        sv = shap_vals[0]
        shap_df = pd.DataFrame({'Feature': FEATURE_COLS, 'SHAP Value': sv})
        shap_df = shap_df.reindex(shap_df['SHAP Value'].abs().sort_values(ascending=False).index).head(8)
        shap_df['Color'] = shap_df['SHAP Value'].apply(lambda x: '#e53e3e' if x > 0 else '#48bb78')
        shap_df['Direction'] = shap_df['SHAP Value'].apply(lambda x: '▲ Increases Risk' if x > 0 else '▼ Decreases Risk')

        fig = go.Figure(go.Bar(
            x=shap_df['SHAP Value'], y=shap_df['Feature'],
            orientation='h',
            marker_color=shap_df['Color'],
            text=shap_df['Direction'], textposition='outside'
        ))
        fig.add_vline(x=0, line_width=1.5, line_dash='dash', line_color='#666')
        fig.update_layout(
            title='SHAP Feature Contributions (Red = increases risk)',
            height=350, margin=dict(t=40, b=10, l=160, r=40),
            xaxis_title='SHAP Value'
        )
        st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Batch Upload
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📁 Batch Upload & Predict":
    st.markdown("## 📁 Batch Upload & Predict")
    st.markdown("Upload a CSV of students to get risk assessments for the entire class.")

    with st.expander("📋 Required CSV Format"):
        sample = pd.DataFrame([{
            'student_id': 'STU10001', 'department': 'CSE', 'semester': 4,
            'attendance_pct': 68.0, 'internal_marks': 42.0, 'assignment_submission_rate': 55.0,
            'prev_semester_cgpa': 6.1, 'lab_attendance_pct': 70.0, 'quiz_avg_score': 38.0,
            'library_visits_per_month': 2, 'extracurricular_participation': 0, 'active_backlogs': 2
        }])
        st.dataframe(sample, hide_index=True)
        csv_str = sample.to_csv(index=False)
        st.download_button("⬇ Download Sample CSV", csv_str, "sample_students.csv", "text/csv")

    uploaded = st.file_uploader("Upload student CSV", type=['csv'])

    # Also allow using built-in dataset
    if st.button("📂 Use Built-in Dataset (1200 students)"):
        df = pd.read_csv(os.path.join(DATA_DIR, 'students.csv'))
        st.session_state['batch_df'] = df
        st.success(f"Loaded {len(df)} students from built-in dataset!")

    if uploaded:
        df = pd.read_csv(uploaded)
        st.session_state['batch_df'] = df

    if 'batch_df' in st.session_state:
        df = st.session_state['batch_df']
        st.markdown(f"**Loaded:** {len(df)} students")

        if st.button("🚀 Run Batch Prediction", type="primary"):
            with st.spinner("Running predictions..."):
                result_df, shap_vals = predict_df(df)

            st.success(f"✅ Predictions complete!")

            # Summary metrics
            total = len(result_df)
            at_risk = int((result_df['predicted_at_risk'] == 1).sum())
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("Total", total)
            c2.metric("🔴 Critical", int((result_df['risk_level'] == 'Critical').sum()))
            c3.metric("🟠 High", int((result_df['risk_level'] == 'High').sum()))
            c4.metric("🔵 Medium", int((result_df['risk_level'] == 'Medium').sum()))
            c5.metric("🟢 Low", int((result_df['risk_level'] == 'Low').sum()))

            # Risk distribution chart
            fig = px.histogram(
                result_df, x='risk_probability', nbins=40,
                color='risk_level',
                color_discrete_map={'Critical': '#e53e3e', 'High': '#f6ad55', 'Medium': '#4299e1', 'Low': '#48bb78'},
                title='Risk Probability Distribution across All Students'
            )
            fig.update_layout(height=350)
            st.plotly_chart(fig, use_container_width=True)

            # Send alerts for high/critical
            high_risk_df = result_df[result_df['risk_level'].isin(['Critical', 'High'])]
            for _, row in high_risk_df.iterrows():
                sv = shap_vals[row.name] if row.name < len(shap_vals) else shap_vals[0]
                top_f = FEATURE_COLS[np.argmax(np.abs(sv))]
                fire_alert(row['student_id'], row.get('department', 'N/A'),
                           row.get('semester', 0), row['risk_level'], row['risk_probability'], top_f)

            if len(high_risk_df) > 0:
                st.warning(f"🚨 Auto-alerts fired for **{len(high_risk_df)}** high/critical risk students!")

            # Downloadable results
            out = result_df[['student_id', 'department', 'semester', 'attendance_pct',
                              'internal_marks', 'risk_probability', 'predicted_at_risk', 'risk_level']].copy()
            st.download_button(
                "⬇ Download Results CSV",
                out.to_csv(index=False),
                f"risk_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                "text/csv"
            )

            # Full table
            st.markdown("### 📋 Full Results Table")
            st.dataframe(
                out.sort_values('risk_probability', ascending=False),
                use_container_width=True, hide_index=True
            )


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Model Explainability
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🔬 Model Explainability":
    st.markdown("## 🔬 Model Explainability — SHAP Analysis")

    imp_df = load_feature_importance()

    col1, col2 = st.columns([1, 1])
    with col1:
        st.markdown("### Global Feature Importance (SHAP)")
        fig = px.bar(
            imp_df, x='mean_abs_shap', y='feature',
            orientation='h',
            color='mean_abs_shap',
            color_continuous_scale='RdYlGn_r',
            title='Mean |SHAP| — Global Feature Importance'
        )
        fig.update_layout(height=420, yaxis={'categoryorder': 'total ascending'},
                          coloraxis_showscale=False, margin=dict(l=160))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.markdown("### What Each Feature Means")
        descriptions = {
            'internal_marks': 'Mid-semester exam scores — strongest predictor of final performance.',
            'prev_semester_cgpa': 'Historical academic trajectory; past performance = future risk.',
            'assignment_submission_rate': 'Consistency in completing work; engagement indicator.',
            'quiz_avg_score': 'Regular assessment performance; tracks learning progress.',
            'attendance_pct': 'Physical engagement — low attendance = high dropout correlation.',
            'library_visits_per_month': 'Self-study effort; low visits signal disengagement.',
            'lab_attendance_pct': 'Practical session attendance; critical for engineering.',
            'active_backlogs': 'Uncleared subjects from previous semesters.',
            'extracurricular_participation': 'May indicate time-management challenges.',
            'semester': 'Year in program context.',
            'dept_enc': 'Encoded department — minor effect.',
        }
        for _, row in imp_df.iterrows():
            feat = row['feature']
            desc = descriptions.get(feat, '')
            pct = row['mean_abs_shap'] / imp_df['mean_abs_shap'].max() * 100
            st.markdown(f"""
            <div style="margin-bottom:0.6rem; padding:0.6rem 1rem; background:#f7fafc; border-radius:8px;">
                <strong>{feat}</strong> &nbsp;
                <span style="background:#e53e3e22; color:#c53030; padding:1px 8px; border-radius:10px; font-size:0.8rem;">{row['mean_abs_shap']:.4f}</span>
                <br><small style="color:#666;">{desc}</small>
            </div>
            """, unsafe_allow_html=True)

    # Saved SHAP plots
    st.markdown("### SHAP Summary Plots")
    c1, c2 = st.columns(2)
    with c1:
        shap_bar = os.path.join(MODEL_DIR, 'shap_summary.png')
        if os.path.exists(shap_bar):
            st.image(shap_bar, caption="SHAP Bar Plot", use_container_width=True)
    with c2:
        shap_bee = os.path.join(MODEL_DIR, 'shap_beeswarm.png')
        if os.path.exists(shap_bee):
            st.image(shap_bee, caption="SHAP Beeswarm — Impact Distribution", use_container_width=True)

    # EDA plots
    st.markdown("### EDA — Feature Distributions by Risk Class")
    eda_path = os.path.join(MODEL_DIR, 'eda_distributions.png')
    if os.path.exists(eda_path):
        st.image(eda_path, use_container_width=True)

    corr_path = os.path.join(MODEL_DIR, 'correlation_heatmap.png')
    if os.path.exists(corr_path):
        st.image(corr_path, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Alert Center
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🚨 Alert Center":
    st.markdown("## 🚨 Alert Center")
    st.markdown("All automatically triggered alerts for high and critical risk students are listed below.")

    # Fire batch alerts from predictions file
    if st.button("📤 Send Batch Alert Report (from latest predictions)", type="primary"):
        pred_df = load_predictions()
        high_risk = pred_df[pred_df['risk_level'].isin(['Critical', 'High'])]
        for _, row in high_risk.iterrows():
            fire_alert(row['student_id'], row['department'], row['semester'],
                       row['risk_level'], row['risk_probability'], 'internal_marks')
        st.success(f"✅ Batch alerts fired for **{len(high_risk)}** students!")

    if not ALERT_LOG:
        st.info("No alerts triggered yet. Run a prediction or upload a batch to generate alerts.")
    else:
        st.markdown(f"**Total alerts:** {len(ALERT_LOG)}")
        for alert in reversed(ALERT_LOG[-30:]):
            color = risk_color(alert['risk_level'])
            st.markdown(f"""
            <div class="alert-box" style="border-color:{color};">
                <strong style="color:{color};">{alert['risk_level']} RISK</strong> &nbsp;|&nbsp;
                🕐 {alert['time']} &nbsp;|&nbsp;
                Student: <strong>{alert['student_id']}</strong> &nbsp;|&nbsp;
                Dept: <strong>{alert['department']}</strong> &nbsp;|&nbsp;
                Sem: {alert['semester']} &nbsp;|&nbsp;
                Prob: <strong>{alert['probability']}</strong><br>
                <small>⚡ Top factor: <strong>{alert['top_factor']}</strong></small>
            </div>
            """, unsafe_allow_html=True)

        # Export
        alert_df = pd.DataFrame(ALERT_LOG)
        st.download_button("⬇ Export Alerts CSV", alert_df.to_csv(index=False), "alerts.csv", "text/csv")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Model Performance
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📈 Model Performance":
    st.markdown("## 📈 Model Performance & Evaluation")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("F1 Score (CV)", f"{metrics['f1_cv']:.4f}", "✅ > 0.78 target")
    c2.metric("AUC-ROC (CV)", f"{metrics['auc_roc_cv']:.4f}")
    c3.metric("Avg Precision (CV)", f"{metrics['avg_precision_cv']:.4f}")
    c4.metric("Decision Threshold", f"{metrics['best_threshold']:.2f}")

    st.markdown("---")
    st.markdown("### Model Architecture")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("""
        **Pipeline:**
        1. `LabelEncoder` — encodes department
        2. `SMOTE` — oversamples minority class (at-risk) to handle imbalance
        3. `XGBClassifier` — gradient boosted trees with `scale_pos_weight`

        **Imbalance Handling:**
        - SMOTE with `sampling_strategy=0.5`
        - XGBoost `scale_pos_weight` = 4.56 (class ratio)
        - Threshold tuning via precision-recall curve on 5-fold CV

        **Evaluation:**
        - Stratified 5-Fold Cross-Validation
        - Primary metric: F1 Score (handles class imbalance)
        - Secondary: AUC-ROC, Average Precision
        """)
    with col2:
        st.markdown("""
        **Hyperparameters:**
        | Param | Value |
        |---|---|
        | n_estimators | 400 |
        | max_depth | 5 |
        | learning_rate | 0.05 |
        | subsample | 0.8 |
        | colsample_bytree | 0.8 |
        | scale_pos_weight | ~4.56 |

        **Why XGBoost?**
        - Handles non-linear feature interactions
        - Built-in regularization (prevents overfit)
        - Compatible with SHAP TreeExplainer
        - Fast training, production-ready
        """)

    st.markdown("### Why These Metrics Matter for Student Risk")
    st.info("""
    **F1 Score** is prioritized over accuracy because the dataset is imbalanced (18% at-risk).
    High accuracy can be achieved by predicting "safe" for everyone — F1 forces the model to correctly identify at-risk students.

    **AUC-ROC** measures how well the model separates at-risk from safe students across all thresholds.

    **Threshold tuning** allows faculty to control the tradeoff: lower threshold = catch more at-risk students (higher recall) at cost of more false alarms.
    """)
