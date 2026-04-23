import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { BrainCircuit, RefreshCw, Play, CheckCircle, Info } from 'lucide-react'
import { mlAPI } from '../utils/api'
import { PageLoader, StatCard, Alert as AlertBox, Spinner } from '../components/ui/index.jsx'
import { fmtNum, fmtDateTime, classNames } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

export default function ModelPage() {
  const { isAdmin } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [importance, setImportance] = useState([])
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([mlAPI.metrics(), mlAPI.featureImportance()])
      setMetrics(mRes.data)
      setImportance((iRes.data.feature_importance || []).map(f => ({
        ...f,
        label: f.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        pct: Math.round(f.importance * 100) / 100,
      })))
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('No trained model found. Click "Train Model" to start.')
      } else {
        toast.error('Failed to load model metrics')
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleTrain = async () => {
    if (!window.confirm('Retrain the model? This runs in the background and may take a minute.')) return
    setTraining(true)
    try {
      await mlAPI.train()
      toast.success('Model training started! Metrics will update in ~1 min.')
      setTimeout(() => load(), 10000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Training failed')
    } finally { setTraining(false) }
  }

  if (loading) return <PageLoader />

  // Confusion matrix data
  const cm = metrics?.confusion_matrix
  // cm = [[TN, FP], [FN, TP]]

  const radarData = metrics ? [
    { metric: 'F1 Score',  value: +(metrics.f1_score * 100).toFixed(1) },
    { metric: 'AUC-ROC',   value: +(metrics.auc_roc * 100).toFixed(1) },
    { metric: 'Precision', value: +(metrics.precision * 100).toFixed(1) },
    { metric: 'Recall',    value: +(metrics.recall * 100).toFixed(1) },
    { metric: 'Avg Prec',  value: +(metrics.avg_precision * 100).toFixed(1) },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Model & Metrics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            XGBoost + SMOTE · {metrics ? `v${metrics.model_version}` : 'No model'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {isAdmin && (
            <button onClick={handleTrain} disabled={training} className="btn-primary gap-2">
              {training ? <Spinner size="sm" /> : <Play className="h-4 w-4" />}
              {training ? 'Training…' : 'Retrain Model'}
            </button>
          )}
        </div>
      </div>

      {!metrics ? (
        <div className="card p-8 text-center">
          <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No model trained yet.</p>
          {isAdmin && <button onClick={handleTrain} className="btn-primary mt-4 mx-auto">Train Now</button>}
        </div>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="F1 Score" value={fmtNum(metrics.f1_score, 4)}
              color={metrics.f1_score >= 0.78 ? 'green' : 'red'}
              sub={metrics.f1_score >= 0.78 ? '✓ Exceeds target' : '⚠ Below 0.78 target'} />
            <StatCard label="AUC-ROC"  value={fmtNum(metrics.auc_roc, 4)}  color="blue" sub="5-fold CV" />
            <StatCard label="Precision" value={fmtNum(metrics.precision, 4)} color="purple" />
            <StatCard label="Recall"    value={fmtNum(metrics.recall, 4)}    color="orange" />
            <StatCard label="Avg Precision" value={fmtNum(metrics.avg_precision, 4)} color="blue" />
          </div>

          {/* Info row */}
          <div className="card px-5 py-3 flex items-center flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Model Active</span>
            </div>
            <span className="text-slate-500">Version: <strong className="text-slate-700 dark:text-slate-300 font-mono">{metrics.model_version}</strong></span>
            <span className="text-slate-500">Threshold: <strong className="font-mono">{metrics.threshold}</strong></span>
            <span className="text-slate-500">Trained on: <strong>{metrics.n_samples} samples</strong> ({metrics.n_at_risk} at-risk)</span>
            <span className="text-slate-500">Last trained: <strong>{fmtDateTime(metrics.trained_at)}</strong></span>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Radar chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-4">Performance Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip formatter={v => [`${v}%`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Confusion matrix */}
            {cm && (
              <div className="card p-5">
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-4">Confusion Matrix (CV)</h3>
                <div className="flex flex-col items-center gap-2 mt-4">
                  <div className="text-xs text-slate-500 mb-1">← Predicted →</div>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                    {[
                      { label: 'True Negative', val: cm[0]?.[0], color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', sub: 'Correctly Safe' },
                      { label: 'False Positive', val: cm[0]?.[1], color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300', sub: 'False Alarm' },
                      { label: 'False Negative', val: cm[1]?.[0], color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300', sub: 'Missed Risk' },
                      { label: 'True Positive', val: cm[1]?.[1], color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300', sub: 'Caught Risk' },
                    ].map(({ label, val, color, sub }) => (
                      <div key={label} className={classNames('rounded-xl p-4 text-center', color)}>
                        <div className="text-2xl font-bold font-mono">{val ?? '?'}</div>
                        <div className="text-xs font-semibold mt-1">{label}</div>
                        <div className="text-xs opacity-70">{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <AlertBox type="info" message="False Negatives = missed at-risk students. Model is optimized to minimize these." className="mt-4" />
              </div>
            )}
          </div>

          {/* Feature importance */}
          {importance.length > 0 && (
            <div className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">SHAP Feature Importance</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Mean |SHAP| — average impact on model output</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-surface-secondary dark:bg-surface-dark-tertiary px-2.5 py-1.5 rounded-lg">
                  <Info className="h-3.5 w-3.5" />
                  Higher = more predictive
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={importance} layout="vertical" margin={{ left: 160, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={155} />
                  <Tooltip formatter={v => [v.toFixed(5), 'SHAP']} />
                  <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Model architecture info */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-4">Model Architecture</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {[
                { title: 'Algorithm', body: 'XGBoost (Gradient Boosted Trees)\nn_estimators=400, max_depth=5, lr=0.05' },
                { title: 'Imbalance Handling', body: 'SMOTE oversampling (sampling_strategy=0.5)\n+ scale_pos_weight based on class ratio' },
                { title: 'Validation', body: 'Stratified 5-Fold Cross-Validation\nThreshold tuned on CV Precision-Recall curve' },
                { title: 'Explainability', body: 'SHAP TreeExplainer\nPer-student top-5 feature contributions with direction' },
                { title: 'Alert Threshold', body: `Risk ≥ ${metrics.threshold} → at-risk prediction\nHigh/Critical triggers auto email/SMS/dashboard alerts` },
                { title: 'Retraining', body: 'Triggered manually (Admin) or on new bulk upload\nDaily scheduler re-predicts all students at 8:00 AM' },
              ].map(({ title, body }) => (
                <div key={title} className="p-3 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide mb-1">{title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
