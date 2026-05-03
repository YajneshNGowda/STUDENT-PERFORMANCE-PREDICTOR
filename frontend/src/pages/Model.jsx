import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell
} from 'recharts'
import { BrainCircuit, RefreshCw, Play, CheckCircle, Info, Cpu, Target, TrendingUp, Layers } from 'lucide-react'
import { mlAPI } from '../utils/api'
import { PageLoader, StatCard, Alert as AlertBox, Spinner } from '../components/ui/index.jsx'
import { fmtNum, fmtDateTime, classNames } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-xl text-xs">
      <div className="font-bold text-slate-700 dark:text-slate-200">{payload[0]?.payload?.label}</div>
      <div className="text-brand-600 dark:text-brand-400 font-mono font-bold mt-0.5">{Number(payload[0]?.value).toFixed(5)}</div>
    </div>
  )
}

export default function ModelPage() {
  const { isAdmin } = useAuth()
  const [metrics,    setMetrics]    = useState(null)
  const [importance, setImportance] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [training,   setTraining]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([mlAPI.metrics(), mlAPI.featureImportance()])
      setMetrics(mRes.data)
      setImportance((iRes.data.feature_importance || []).map(f => ({
        ...f,
        label: f.feature.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
        pct: Math.round(f.importance * 100) / 100,
      })))
    } catch (err) {
      if (err.response?.status === 404) toast.error('No trained model. Click Retrain to start.')
      else toast.error('Failed to load model metrics')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleTrain = async () => {
    if (!window.confirm('Retrain the ML model in the background? (~1 min)')) return
    setTraining(true)
    try {
      await mlAPI.train()
      toast.success('Training started! Metrics update in ~1 min.')
      setTimeout(load, 12000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Training failed')
    } finally { setTraining(false) }
  }

  if (loading) return <PageLoader />

  const cm = metrics?.confusion_matrix

  const radarData = metrics ? [
    { metric:'F1',       value: +(metrics.f1_score  * 100).toFixed(1) },
    { metric:'AUC-ROC',  value: +(metrics.auc_roc   * 100).toFixed(1) },
    { metric:'Precision',value: +(metrics.precision  * 100).toFixed(1) },
    { metric:'Recall',   value: +(metrics.recall     * 100).toFixed(1) },
    { metric:'Avg Prec', value: +(metrics.avg_precision * 100).toFixed(1) },
  ] : []

  const cmCells = cm ? [
    { label:'True Negative',  val:cm[0]?.[0], gradient:'from-emerald-400 to-teal-500',    icon:'✅', sub:'Correctly Safe' },
    { label:'False Positive', val:cm[0]?.[1], gradient:'from-amber-400   to-yellow-500',  icon:'⚠️', sub:'False Alarm' },
    { label:'False Negative', val:cm[1]?.[0], gradient:'from-orange-500  to-red-500',     icon:'❌', sub:'Missed Risk' },
    { label:'True Positive',  val:cm[1]?.[1], gradient:'from-blue-500    to-indigo-600',  icon:'🎯', sub:'Caught Risk' },
  ] : []

  const archItems = [
    { icon:Cpu,       title:'Algorithm',           body:'XGBoost Gradient Boosted Trees\nn_estimators=400 · max_depth=5 · lr=0.05' },
    { icon:Layers,    title:'Imbalance Handling',  body:'SMOTE oversampling (strategy=0.5)\n+ scale_pos_weight auto-computed' },
    { icon:Target,    title:'Validation',          body:'Stratified 5-Fold Cross-Validation\nThreshold tuned on Precision-Recall curve' },
    { icon:BrainCircuit,title:'Explainability',    body:'SHAP TreeExplainer\nPer-student top-5 factor contributions' },
    { icon:TrendingUp,title:'Alert Threshold',     body:`Risk ≥ ${metrics?.threshold?.toFixed(2)||'0.30'} → At-risk\nHigh/Critical → Auto email alerts` },
    { icon:RefreshCw, title:'Retraining',          body:'Admin-triggered or on bulk CSV upload\nDaily scheduler at 08:00 AM IST' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Model & Metrics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            XGBoost + SMOTE · {metrics ? `Version ${metrics.model_version}` : 'No model trained'}
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
        <div className="card p-12 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-brand-100 to-violet-100 dark:from-brand-900/30 dark:to-violet-900/30 flex items-center justify-center mx-auto mb-4">
            <BrainCircuit className="h-8 w-8 text-brand-500" />
          </div>
          <p className="font-bold text-slate-600 dark:text-slate-400 text-lg">No trained model yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-5">Train the model to see metrics, SHAP values, and confusion matrix.</p>
          {isAdmin && (
            <button onClick={handleTrain} className="btn-primary mx-auto gap-2">
              <Play className="h-4 w-4" /> Train Now
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div className="card px-5 py-3.5 flex items-center flex-wrap gap-4"
            style={{background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.06))'}}>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
              </div>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Model Active</span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Version: <strong className="font-mono text-slate-700 dark:text-slate-300">{metrics.model_version}</strong></span>
              <span>Threshold: <strong className="font-mono">{metrics.threshold}</strong></span>
              <span>Trained on: <strong>{metrics.n_samples} samples</strong> ({metrics.n_at_risk} at-risk)</span>
              <span>Last trained: <strong>{fmtDateTime(metrics.trained_at)}</strong></span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label:'F1 Score',       value:fmtNum(metrics.f1_score,4),       color:metrics.f1_score>=0.78?'green':'red',
                sub: metrics.f1_score>=0.78?'✓ Exceeds 0.78 target':'⚠ Below target', icon:Target },
              { label:'AUC-ROC',        value:fmtNum(metrics.auc_roc,4),        color:'blue',   sub:'5-fold CV',   icon:TrendingUp },
              { label:'Precision',      value:fmtNum(metrics.precision,4),      color:'purple', sub:'Exactness',   icon:CheckCircle },
              { label:'Recall',         value:fmtNum(metrics.recall,4),         color:'orange', sub:'Sensitivity', icon:TrendingUp },
              { label:'Avg Precision',  value:fmtNum(metrics.avg_precision,4),  color:'blue',   sub:'PR-AUC',      icon:BrainCircuit },
            ].map(m => <StatCard key={m.label} {...m} />)}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Radar */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                  <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Performance Radar</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(148,163,184,0.2)" />
                  <PolarAngleAxis dataKey="metric" tick={{fontSize:11, fill:'#94a3b8'}} />
                  <PolarRadiusAxis angle={90} domain={[0,100]} tick={{fontSize:9, fill:'#94a3b8'}} />
                  <Radar name="Score" dataKey="value"
                    stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2.5} />
                  <Tooltip formatter={v=>[`${v}%`,'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Confusion Matrix */}
            {cm && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Confusion Matrix (CV)</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {cmCells.map(c => (
                    <div key={c.label}
                      className={`rounded-2xl p-4 text-center bg-gradient-to-br ${c.gradient} text-white shadow-md`}>
                      <div className="text-2xl mb-1">{c.icon}</div>
                      <div className="text-3xl font-black">{c.val ?? '?'}</div>
                      <div className="text-xs font-bold mt-1 opacity-90">{c.label}</div>
                      <div className="text-xs opacity-70">{c.sub}</div>
                    </div>
                  ))}
                </div>
                <AlertBox type="info"
                  message="False Negatives (missed at-risk) are minimised. The model is optimised for student safety over precision." />
              </div>
            )}
          </div>

          {/* Feature Importance */}
          {importance.length > 0 && (
            <div className="card p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                      <BrainCircuit className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">SHAP Feature Importance</h3>
                  </div>
                  <p className="text-xs text-slate-500 ml-9">Mean |SHAP| — average impact on model output magnitude</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Info className="h-3.5 w-3.5" />
                  Higher = more predictive
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={importance} layout="vertical" margin={{left:170,right:20,top:5,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{fontSize:11,fill:'#64748b'}} width={165} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip/>} />
                  <Bar dataKey="importance" radius={[0,6,6,0]}>
                    {importance.map((_, i) => {
                      const colors = ['#6366f1','#8b5cf6','#a855f7','#c084fc','#e879f9','#f472b6','#fb7185','#f97316','#fbbf24','#34d399','#22d3ee']
                      return <Cell key={i} fill={colors[i % colors.length]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Architecture */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Cpu className="h-4 w-4 text-slate-500" />
              </div>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Model Architecture</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archItems.map(({ icon:Icon, title, body }) => (
                <div key={title}
                  className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-700/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-brand-500" />
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{title}</div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
