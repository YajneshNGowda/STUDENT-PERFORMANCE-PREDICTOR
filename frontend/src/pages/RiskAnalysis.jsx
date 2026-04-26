/**
 * Individual Student Risk Analysis page (staff use)
 * Full deep-dive: metrics, SHAP, trend, conditions, recommendations
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import { ArrowLeft, AlertTriangle, CheckCircle, TrendingDown, User, RefreshCw, Activity } from 'lucide-react'
import { studentsAPI } from '../utils/api'
import { PageLoader, RiskBadge } from '../components/ui/index.jsx'
import { fmtNum, classNames, CONDITION_LABELS, CONDITION_COLORS, getRiskConfig } from '../utils/helpers'

const PRIORITY_BG = {
  HIGH:   'bg-red-50    dark:bg-red-900/15   border border-red-200   dark:border-red-800',
  MEDIUM: 'bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800',
  LOW:    'bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800',
}

export default function RiskAnalysisPage() {
  const { id }   = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await studentsAPI.riskAnalysis(id)
      setData(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load analysis')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <PageLoader />
  if (!data)   return <div className="text-slate-500 text-center py-20">Student not found.</div>

  const { student, academic_metrics, risk_analysis, recommendations, prediction_trend, summary } = data
  const riskCfg = getRiskConfig(risk_analysis.risk_level)
  const riskPct = risk_analysis.risk_probability

  // Radar data — normalise to 0–100
  const radarData = [
    { metric:'Attendance',    value: academic_metrics.attendance_pct,             full:100 },
    { metric:'Int. Marks',    value: academic_metrics.internal_marks,              full:100 },
    { metric:'Assignment',    value: academic_metrics.assignment_submission_rate,  full:100 },
    { metric:'Quiz Avg',      value: academic_metrics.quiz_avg_score,              full:100 },
    { metric:'Lab Attend.',   value: academic_metrics.lab_attendance_pct,          full:100 },
    { metric:'CGPA×10',       value: academic_metrics.prev_semester_cgpa * 10,     full:100 },
  ]

  const shapData = (risk_analysis.top_risk_factors || []).map(f => ({
    feature: f.feature.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()),
    value:   Math.abs(f.shap_value) * 100,
    positive: f.impact === 'increases',
    rawVal:  f.value,
  }))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link to="/students" className="btn-ghost gap-1 text-sm"><ArrowLeft className="h-4 w-4"/> Students</Link>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <Activity className="h-4 w-4 text-brand-600" />
        <span className="font-semibold text-slate-700 dark:text-slate-300">Individual Risk Analysis</span>
        <button onClick={load} className="ml-auto btn-ghost p-1.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Student identity + risk score */}
      <div className={classNames('card p-6 border-2', riskCfg.border)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <User className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{student.full_name}</h1>
              <p className="text-sm text-slate-500 font-mono">{student.usn}
                <span className="font-sans"> · {student.department_name} · Sem {student.semester}{student.section}</span>
              </p>
            </div>
          </div>
          {/* Big risk indicator */}
          <div className={classNames('flex flex-col items-center px-6 py-4 rounded-xl border-2', riskCfg.border, riskCfg.bg)}>
            <div className={classNames('text-4xl font-black', riskCfg.color)}>{riskPct.toFixed(1)}%</div>
            <RiskBadge level={risk_analysis.risk_level} />
            <div className="text-xs text-slate-500 mt-1">Risk Score</div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 text-sm text-slate-700 dark:text-slate-300">
          {summary}
        </div>

        {/* Alert conditions */}
        {risk_analysis.alert_conditions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {risk_analysis.alert_conditions.map(c => (
              <span key={c.code} className={classNames('badge', CONDITION_COLORS[c.code])}>
                ⚠ {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Radar */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Academic Performance Radar</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="metric" tick={{fontSize:10}} />
              <PolarRadiusAxis domain={[0,100]} tick={{fontSize:9}} />
              <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip formatter={v=>[`${v.toFixed(1)}%`,'Score']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk trend */}
        {prediction_trend?.length > 0 ? (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Probability Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={prediction_trend} margin={{top:5,right:10,bottom:0,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{fontSize:10}} />
                <YAxis domain={[0,100]} tick={{fontSize:10}} />
                <Tooltip formatter={v=>[`${v}%`,'Risk']} />
                <ReferenceLine y={55} stroke="#f97316" strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="risk_probability" stroke="#3b82f6" strokeWidth={2.5}
                  dot={({cx,cy,payload}) => (
                    <circle cx={cx} cy={cy} r={5} fill={payload.risk_level==='Critical'?'#ef4444':payload.risk_level==='High'?'#f97316':'#3b82f6'} />
                  )} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-2 text-xs text-slate-500 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> High threshold (55%)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> Critical threshold (75%)</span>
            </div>
          </div>
        ) : (
          <div className="card p-5 flex items-center justify-center text-slate-400 text-sm">
            No trend data yet — run predictions over multiple sessions.
          </div>
        )}
      </div>

      {/* SHAP Feature Impact */}
      {shapData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">SHAP Feature Contributions</h3>
          <p className="text-xs text-slate-500 mb-4">How each academic metric contributes to the risk score (higher bar = stronger influence)</p>
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shapData} layout="vertical" margin={{left:130,right:20}}>
                <XAxis type="number" tick={{fontSize:10}} />
                <YAxis type="category" dataKey="feature" tick={{fontSize:10}} width={125} />
                <Tooltip formatter={v=>[`${v.toFixed(1)}%`,'Impact']} />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {shapData.map((e,i) => <Cell key={i} fill={e.positive?'#ef4444':'#22c55e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {risk_analysis.top_risk_factors?.slice(0,5).map((f,i) => {
                const feat  = f.feature.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
                const isRisk = f.impact === 'increases'
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{feat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">val: {f.value}</span>
                      <span className={classNames('font-semibold', isRisk?'text-red-600 dark:text-red-400':'text-green-600 dark:text-green-400')}>
                        {isRisk?'▲ risk':'▼ risk'}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div className="text-xs text-slate-400 pt-1">
                🔴 Red = increases risk &nbsp;|&nbsp; 🟢 Green = decreases risk
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Action Plan & Recommendations</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {recommendations.map((rec,i) => (
              <div key={i} className={classNames('p-4 rounded-xl', PRIORITY_BG[rec.priority])}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{rec.issue}</div>
                  <span className={classNames('text-xs font-bold px-2 py-0.5 rounded-full',
                    rec.priority==='HIGH'?'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400':
                    rec.priority==='MEDIUM'?'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400':
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400')}>
                    {rec.priority}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400 mb-2 font-mono">
                  <span>Now: <strong>{rec.value}</strong></span>
                  <span>Target: <strong className="text-green-600 dark:text-green-400">{rec.target}</strong></span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No issues banner */}
      {recommendations?.length === 0 && (
        <div className="card p-6 text-center border-green-200 dark:border-green-800">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-700 dark:text-green-400">No critical issues detected</p>
          <p className="text-sm text-slate-500 mt-1">Student is performing within acceptable academic parameters.</p>
        </div>
      )}
    </div>
  )
}
