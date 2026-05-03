import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import {
  ArrowLeft, AlertTriangle, CheckCircle, User, RefreshCw,
  Activity, Zap, Target, TrendingUp, Brain, Star, Shield,
  BookOpen, Clock, Award, Layers
} from 'lucide-react'
import { studentsAPI } from '../utils/api'
import { PageLoader, RiskBadge } from '../components/ui/index.jsx'
import { fmtNum, classNames, CONDITION_LABELS, CONDITION_COLORS, getRiskConfig } from '../utils/helpers'

const PRIORITY_STYLES = {
  HIGH:   { bg:'bg-red-50    dark:bg-red-900/15',    border:'border-red-200    dark:border-red-800',    badge:'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',    icon:'🔴' },
  MEDIUM: { bg:'bg-orange-50 dark:bg-orange-900/15', border:'border-orange-200 dark:border-orange-800', badge:'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon:'🟠' },
  LOW:    { bg:'bg-yellow-50 dark:bg-yellow-900/15', border:'border-yellow-200 dark:border-yellow-800', badge:'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon:'🟡' },
}

const RISK_GRADIENT = {
  Critical: 'from-red-500    to-rose-600',
  High:     'from-orange-500 to-amber-500',
  Medium:   'from-yellow-400 to-amber-400',
  Low:      'from-green-400  to-emerald-500',
}

const SHAP_COLORS = ['#6366f1','#8b5cf6','#a855f7','#c084fc','#e879f9','#f472b6','#fb7185']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-xl border-0 text-xs">
      <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</div>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{background:p.color||'#6366f1'}} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

export default function RiskAnalysisPage() {
  const { id }                  = useParams()
  const [data,    setData]      = useState(null)
  const [loading, setLoading]   = useState(true)
  const [refresh, setRefresh]   = useState(false)

  const load = async (silent=false) => {
    if (!silent) setLoading(true); else setRefresh(true)
    try {
      const r = await studentsAPI.riskAnalysis(id)
      setData(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load analysis')
    } finally { setLoading(false); setRefresh(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <PageLoader />
  if (!data)   return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Student not found.</p>
      </div>
    </div>
  )

  const { student, academic_metrics: am, risk_analysis: ra, recommendations, prediction_trend, summary } = data
  const riskCfg  = getRiskConfig(ra.risk_level)
  const riskPct  = ra.risk_probability
  const grad     = RISK_GRADIENT[ra.risk_level] || RISK_GRADIENT.Low

  // Radar data — normalise each to 0-100
  const radarData = [
    { metric:'Attendance',   value: am.attendance_pct,              full:100 },
    { metric:'Int. Marks',   value: am.internal_marks,              full:100 },
    { metric:'Assignments',  value: am.assignment_submission_rate,  full:100 },
    { metric:'Quiz Score',   value: am.quiz_avg_score,              full:100 },
    { metric:'Lab Attend.',  value: am.lab_attendance_pct,          full:100 },
    { metric:'CGPA×10',      value: am.prev_semester_cgpa * 10,     full:100 },
  ]

  // SHAP bar data
  const shapData = (ra.top_risk_factors || []).map(f => ({
    feature:  f.feature.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
    value:    +(Math.abs(f.shap_value) * 100).toFixed(2),
    positive: f.impact === 'increases',
    rawVal:   f.value,
    shap:     f.shap_value,
  }))

  const metricItems = [
    { label:'Attendance',     value:`${fmtNum(am.attendance_pct,1)}%`,           icon:User,       status: am.attendance_pct<75 ? 'bad' : am.attendance_pct>=85 ? 'good':'ok' },
    { label:'Internal Marks', value:`${fmtNum(am.internal_marks,1)}/100`,         icon:BookOpen,   status: am.internal_marks<40 ? 'bad' : am.internal_marks>=70 ? 'good':'ok' },
    { label:'Assignment Rate',value:`${fmtNum(am.assignment_submission_rate,1)}%`, icon:CheckCircle,status: am.assignment_submission_rate<60 ? 'bad':'ok' },
    { label:'CGPA',           value:fmtNum(am.prev_semester_cgpa,2),             icon:Award,      status: am.prev_semester_cgpa>0&&am.prev_semester_cgpa<5 ? 'bad' : am.prev_semester_cgpa>=8 ? 'good':'ok' },
    { label:'Lab Attendance', value:`${fmtNum(am.lab_attendance_pct,1)}%`,        icon:Activity,   status: am.lab_attendance_pct<75 ? 'bad':'ok' },
    { label:'Quiz Avg',       value:`${fmtNum(am.quiz_avg_score,1)}/100`,         icon:Target,     status: am.quiz_avg_score<40 ? 'bad':'ok' },
    { label:'Library/mo',     value:am.library_visits_per_month,                  icon:BookOpen,   status:'ok' },
    { label:'Backlogs',       value:am.active_backlogs,                           icon:AlertTriangle, status: am.active_backlogs>=2 ? 'bad' : am.active_backlogs===0 ? 'good':'ok' },
  ]
  const statusColor = { bad:'text-red-600 dark:text-red-400', good:'text-green-600 dark:text-green-400', ok:'text-slate-700 dark:text-slate-200' }
  const statusBg    = { bad:'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800', good:'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800', ok:'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700' }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-3">
        <Link to="/students"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors group">
          <div className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-brand-400 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <span>Students</span>
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Brain className="h-4 w-4 text-brand-500" />
          Individual Risk Analysis
        </div>
        <button onClick={() => load(true)} disabled={refresh}
          className="ml-auto btn-ghost p-1.5">
          <RefreshCw className={classNames('h-4 w-4', refresh && 'animate-spin')} />
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="card overflow-hidden">
        {/* Top gradient bar */}
        <div className={`h-2 bg-gradient-to-r ${grad}`} />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">

            {/* Student info */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0"
                style={{background:'linear-gradient(135deg,#4f46e5,#a855f7)'}}>
                {student.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 dark:text-white">{student.full_name}</h1>
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-lg">
                    {student.usn}
                  </span>
                  <span className="text-xs text-slate-500">{student.department_name}</span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-500">Sem {student.semester}{student.section}</span>
                  {student.batch_year && (
                    <><span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                    <span className="text-xs text-slate-500">Batch {student.batch_year}</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Big risk score */}
            <div className={`rounded-2xl px-7 py-5 text-center text-white shadow-xl bg-gradient-to-br ${grad} flex-shrink-0`}>
              <div className="text-4xl font-black leading-none">{riskPct.toFixed(1)}%</div>
              <div className="text-xs font-bold opacity-75 mt-1 mb-2">Risk Probability</div>
              <RiskBadge level={ra.risk_level} />
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-brand-600 dark:text-brand-400 mr-1">AI Summary:</span>
              {summary}
            </div>
          )}

          {/* Alert conditions */}
          {ra.alert_conditions?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ra.alert_conditions.map(c => (
                <span key={c.code}
                  className={classNames('text-xs px-3 py-1 rounded-full font-semibold border',
                    CONDITION_COLORS[c.code] || 'bg-slate-100 text-slate-600 border-slate-200')}>
                  ⚠ {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Academic metrics grid ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-brand-500" />
          <h2 className="font-bold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide">Academic Metrics Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metricItems.map(m => (
            <div key={m.label}
              className={classNames('rounded-2xl p-3.5 border transition-all', statusBg[m.status])}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{m.label}</span>
                <m.icon className={classNames('h-3.5 w-3.5', m.status==='bad' ? 'text-red-400' : m.status==='good' ? 'text-green-400' : 'text-slate-400')} />
              </div>
              <div className={classNames('text-xl font-black', statusColor[m.status])}>{m.value}</div>
              {m.status === 'bad'  && <div className="text-xs text-red-500   font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Needs attention</div>}
              {m.status === 'good' && <div className="text-xs text-green-500 font-semibold mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Excellent</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Radar */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Performance Radar</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(148,163,184,0.15)" />
              <PolarAngleAxis dataKey="metric" tick={{fontSize:10, fill:'#94a3b8'}} />
              <PolarRadiusAxis angle={90} domain={[0,100]} tick={{fontSize:9, fill:'#94a3b8'}} />
              <Radar name="Score" dataKey="value"
                stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2.5}
                dot={{r:4, fill:'#6366f1', strokeWidth:0}} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk trend */}
        {prediction_trend?.length > 0 ? (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Risk Probability Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={prediction_trend} margin={{top:5,right:10,bottom:0,left:-25}}>
                <defs>
                  <linearGradient id="raGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="date" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={55} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                <Area type="monotone" dataKey="risk_probability" name="Risk %"
                  stroke="#6366f1" strokeWidth={2.5} fill="url(#raGrad)"
                  dot={({ cx, cy, payload }) => (
                    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} strokeWidth={0}
                      fill={payload.risk_level==='Critical'?'#ef4444':payload.risk_level==='High'?'#f97316':payload.risk_level==='Medium'?'#eab308':'#22c55e'} />
                  )} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-slate-400 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-orange-400 inline-block rounded" />High (55%)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 inline-block rounded" />Critical (75%)</span>
            </div>
          </div>
        ) : (
          <div className="card p-5 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No trend data yet</p>
              <p className="text-xs mt-1">Run more predictions to build history</p>
            </div>
          </div>
        )}
      </div>

      {/* ── SHAP Feature Impact ── */}
      {shapData.length > 0 && (
        <div className="card p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">SHAP Feature Contributions</h3>
              </div>
              <p className="text-xs text-slate-500 ml-9">How each factor influences the student's risk score</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={shapData} layout="vertical" margin={{left:140,right:20,top:5,bottom:5}}>
                <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="feature" tick={{fontSize:10,fill:'#64748b'}} width={135} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v,n,p) => [`${v.toFixed(2)}%`, p.payload.positive?'Increases risk':'Decreases risk']} />
                <Bar dataKey="value" radius={[0,6,6,0]}>
                  {shapData.map((e,i) => (
                    <Cell key={i} fill={e.positive ? '#ef4444' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Text breakdown */}
            <div className="space-y-2.5">
              {ra.top_risk_factors?.slice(0,6).map((f,i) => {
                const isRisk = f.impact === 'increases'
                const feat   = f.feature.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase())
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={classNames('h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0',
                      isRisk ? 'bg-red-500' : 'bg-green-500')}>
                      {isRisk ? '▲' : '▼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{feat}</span>
                        <span className="text-xs font-mono text-slate-400 flex-shrink-0 ml-2">val={f.value}</span>
                      </div>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className={classNames('h-full rounded-full', isRisk ? 'bg-red-500' : 'bg-green-500')}
                          style={{width:`${Math.min(Math.abs(f.shap_value)*40,100)}%`}} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-500 inline-block" />Increases risk</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-green-500 inline-block" />Decreases risk</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendations ── */}
      {recommendations?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide">Action Plan & Recommendations</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {recommendations.map((rec, i) => {
              const ps = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.LOW
              return (
                <div key={i}
                  className={classNames('rounded-2xl p-4 border transition-all hover:shadow-md', ps.bg, ps.border)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{ps.icon}</span>
                      {rec.issue}
                    </div>
                    <span className={classNames('text-xs font-black px-2.5 py-0.5 rounded-full ml-2 flex-shrink-0', ps.badge)}>
                      {rec.priority}
                    </span>
                  </div>

                  {/* Current vs target */}
                  <div className="flex gap-4 mb-3 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40">
                    <div className="text-center flex-1">
                      <div className="text-xs text-slate-500 mb-0.5">Current</div>
                      <div className="text-base font-black text-red-600 dark:text-red-400">{rec.value}</div>
                    </div>
                    <div className="flex items-center text-slate-300 dark:text-slate-600 text-lg">→</div>
                    <div className="text-center flex-1">
                      <div className="text-xs text-slate-500 mb-0.5">Target</div>
                      <div className="text-base font-black text-green-600 dark:text-green-400">{rec.target}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.action}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── No issues ── */}
      {recommendations?.length === 0 && !loading && (
        <div className="card p-10 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-xl">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <p className="text-xl font-black text-green-700 dark:text-green-400 mb-1">No Issues Detected 🎉</p>
          <p className="text-slate-500 text-sm">This student is performing within acceptable academic parameters.</p>
        </div>
      )}
    </div>
  )
}
