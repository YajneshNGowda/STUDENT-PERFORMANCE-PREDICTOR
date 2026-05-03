import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import {
  GraduationCap, AlertTriangle, BookOpen, CheckCircle,
  Clock, Users, BarChart2, Award, RefreshCw, TrendingUp,
  TrendingDown, Activity, Zap, Target, Star
} from 'lucide-react'
import { studentsAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { PageLoader, RiskBadge, ShapFactor } from '../components/ui/index.jsx'
import {
  fmtNum, fmtPct, fmtDateTime, classNames,
  CONDITION_LABELS, CONDITION_COLORS, getRiskConfig
} from '../utils/helpers'

const PRIORITY_STYLES = {
  HIGH:   { bar:'bg-red-500',    bg:'bg-red-50    dark:bg-red-900/15',    border:'border-red-200    dark:border-red-800',    text:'text-red-700    dark:text-red-300',    badge:'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400' },
  MEDIUM: { bar:'bg-orange-500', bg:'bg-orange-50 dark:bg-orange-900/15', border:'border-orange-200 dark:border-orange-800', text:'text-orange-700 dark:text-orange-300', badge:'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  LOW:    { bar:'bg-yellow-500', bg:'bg-yellow-50 dark:bg-yellow-900/15', border:'border-yellow-200 dark:border-yellow-800', text:'text-yellow-700 dark:text-yellow-300', badge:'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
}

function MetricTile({ label, value, unit='', warn, good, icon:Icon, pct }) {
  const status = warn ? 'bad' : good ? 'good' : 'neutral'
  const colors  = {
    bad:     { bg:'bg-red-50    dark:bg-red-900/15',    icon:'text-red-500',    val:'text-red-700    dark:text-red-300',    bar:'bg-red-500' },
    good:    { bg:'bg-green-50  dark:bg-green-900/15',  icon:'text-green-500',  val:'text-green-700  dark:text-green-300',  bar:'bg-green-500' },
    neutral: { bg:'bg-slate-50  dark:bg-slate-800/60',  icon:'text-slate-400',  val:'text-slate-800  dark:text-slate-100',  bar:'bg-brand-500' },
  }
  const c = colors[status]
  return (
    <div className={classNames('rounded-2xl p-4 border transition-all', c.bg,
      status==='bad' ? 'border-red-200 dark:border-red-800' : status==='good' ? 'border-green-200 dark:border-green-800' : 'border-slate-200 dark:border-slate-700')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={classNames('h-4 w-4', c.icon)} />}
      </div>
      <div className={classNames('text-2xl font-black leading-none', c.val)}>
        {value}{unit && <span className="text-sm font-semibold ml-0.5 opacity-70">{unit}</span>}
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className={classNames('h-full rounded-full transition-all duration-700', c.bar)}
            style={{width:`${Math.min(pct,100)}%`}} />
        </div>
      )}
      {warn && <p className="text-xs mt-1.5 font-semibold text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>{warn}</p>}
      {good && <p className="text-xs mt-1.5 font-semibold text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>{good}</p>}
    </div>
  )
}

export default function StudentPortal() {
  const { user, isParent } = useAuth()
  const [profile,    setProfile]    = useState(null)
  const [analysis,   setAnalysis]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent=false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const [pRes, aRes] = await Promise.all([
        studentsAPI.myProfile(),
        studentsAPI.riskAnalysis(user?.linked_student_id || 0).catch(() => null),
      ])
      setProfile(pRes.data)
      if (aRes) setAnalysis(aRes.data)
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to load profile') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (user) load() }, [user])

  if (loading) return <PageLoader />
  if (!profile) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No student profile found.</p>
        <p className="text-slate-400 text-sm mt-1">Contact your college administrator.</p>
      </div>
    </div>
  )

  const riskCfg  = getRiskConfig(profile.latest_risk_level || 'Low')
  const riskPct  = Math.round((profile.latest_risk_probability || 0) * 100)
  const trend    = analysis?.prediction_trend || []
  const recs     = analysis?.recommendations  || []

  const RISK_GRAD = {
    Critical: 'from-red-500    to-rose-600',
    High:     'from-orange-500 to-amber-500',
    Medium:   'from-yellow-400 to-amber-400',
    Low:      'from-green-400  to-emerald-500',
  }
  const grad = RISK_GRAD[profile.latest_risk_level] || RISK_GRAD.Low

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Hero banner ── */}
      <div className="card overflow-hidden">
        <div className="h-2 bg-gradient-to-r" style={{background:`linear-gradient(90deg,${profile.latest_risk_level==='Critical'?'#ef4444':profile.latest_risk_level==='High'?'#f97316':profile.latest_risk_level==='Medium'?'#eab308':'#22c55e'},transparent)`}} />

        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl"
                  style={{background:'linear-gradient(135deg,#4f46e5,#a855f7)'}}>
                  {profile.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                {/* Status dot */}
                <div className={classNames('absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900',
                  riskPct>55 ? 'bg-red-500' : riskPct>30 ? 'bg-orange-400' : 'bg-green-500')} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-slate-800 dark:text-white">{profile.full_name}</h1>
                  {isParent && <span className="badge bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">Parent View 👨‍👩‍👧</span>}
                </div>
                <div className="flex items-center flex-wrap gap-2 text-sm">
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-lg text-xs">
                    {profile.usn}
                  </span>
                  <span className="text-slate-500">{profile.department_name}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-slate-500">Semester {profile.semester}{profile.section}</span>
                  {profile.batch_year && <><span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-slate-500">Batch {profile.batch_year}</span></>}
                </div>
              </div>
            </div>

            {/* Risk score widget */}
            {profile.latest_risk_level && (
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl px-6 py-4 text-center text-white shadow-xl bg-gradient-to-br ${grad}`}>
                  <div className="text-3xl font-black leading-none">{riskPct}%</div>
                  <div className="text-xs font-bold opacity-80 mt-1">Risk Score</div>
                  <div className="mt-2">
                    <RiskBadge level={profile.latest_risk_level} />
                  </div>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                  className="btn-ghost p-2">
                  <RefreshCw className={classNames('h-4 w-4', refreshing && 'animate-spin')} />
                </button>
              </div>
            )}
          </div>

          {/* Alert conditions */}
          {profile.alert_conditions?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.alert_conditions.map(c => (
                <span key={c} className={classNames('text-xs px-3 py-1 rounded-full font-semibold border',
                  CONDITION_COLORS[c] || 'bg-slate-100 text-slate-600 border-slate-200')}>
                  ⚠ {CONDITION_LABELS[c] || c}
                </span>
              ))}
            </div>
          )}

          {/* Alert notice */}
          {profile.latest_risk_level && ['High','Critical'].includes(profile.latest_risk_level) && (
            <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800">
              <Zap className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong>Automatic alerts have been sent</strong> to your faculty and parent/guardian about your academic status. Please attend the scheduled counseling session.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Academic metrics ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-4 w-4 text-brand-500" />
          <h2 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Academic Performance</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile label="Attendance"     value={fmtNum(profile.attendance_pct,1)}             unit="%" pct={profile.attendance_pct}
            icon={Users}       warn={profile.attendance_pct<75  ? 'Below 75% minimum' : ''}  good={profile.attendance_pct>=85  ? 'Excellent' : ''} />
          <MetricTile label="Internal Marks" value={fmtNum(profile.internal_marks,1)}             unit="/100" pct={profile.internal_marks}
            icon={BookOpen}    warn={profile.internal_marks<40   ? 'Below passing threshold' : ''} good={profile.internal_marks>=70 ? 'Good standing':''} />
          <MetricTile label="Assignment Rate" value={fmtNum(profile.assignment_submission_rate,1)} unit="%" pct={profile.assignment_submission_rate}
            icon={CheckCircle} warn={profile.assignment_submission_rate<60 ? 'Low submission rate':''} />
          <MetricTile label="CGPA"            value={fmtNum(profile.prev_semester_cgpa,2)}
            icon={Award}       warn={profile.prev_semester_cgpa>0&&profile.prev_semester_cgpa<5 ? 'Low CGPA':''} good={profile.prev_semester_cgpa>=8?'Distinction':''} pct={profile.prev_semester_cgpa*10} />
          <MetricTile label="Lab Attendance"  value={fmtNum(profile.lab_attendance_pct,1)}        unit="%" pct={profile.lab_attendance_pct}
            icon={Activity}    warn={profile.lab_attendance_pct<75 ? 'Low lab attendance':''} />
          <MetricTile label="Quiz Avg"        value={fmtNum(profile.quiz_avg_score,1)}            unit="/100" pct={profile.quiz_avg_score}
            icon={Target}      warn={profile.quiz_avg_score<40 ? 'Needs improvement':''} />
          <MetricTile label="Library Visits"  value={profile.library_visits_per_month}            unit="/mo"
            icon={BookOpen}    good={profile.library_visits_per_month>=5 ? 'Active learner':''} />
          <MetricTile label="Backlogs"        value={profile.active_backlogs}
            icon={AlertTriangle} warn={profile.active_backlogs>=2 ? `${profile.active_backlogs} pending`:''} good={profile.active_backlogs===0 ? 'All cleared':''} />
        </div>
      </div>

      {/* ── Trend + SHAP ── */}
      {analysis && (
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Risk trend */}
          {trend.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Risk Score History</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{top:5,right:10,bottom:0,left:-25}}>
                  <defs>
                    <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="date" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v=>[`${v}%`,'Risk Score']} />
                  <ReferenceLine y={55} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="risk_probability" name="Risk Score"
                    stroke="#6366f1" strokeWidth={2.5} fill="url(#riskAreaGrad)"
                    dot={{r:4,fill:'#6366f1',strokeWidth:0}} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-slate-400 justify-center">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-orange-400 inline-block rounded" />High Risk (55%)</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 inline-block rounded" />Critical (75%)</span>
              </div>
            </div>
          )}

          {/* SHAP factors */}
          {analysis.risk_analysis?.top_risk_factors?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  What's Affecting Your Risk Score
                </h3>
              </div>
              <div className="space-y-1">
                {analysis.risk_analysis.top_risk_factors.slice(0,5).map((f,i) => (
                  <ShapFactor key={i} {...f} />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                🔴 Increases risk &nbsp;·&nbsp; 🟢 Decreases risk
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {recs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
              Personalised Action Plan
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {recs.map((rec, i) => {
              const ps = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.LOW
              return (
                <div key={i} className={classNames('rounded-2xl p-4 border', ps.bg, ps.border)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{rec.issue}</div>
                    <span className={classNames('text-xs font-black px-2 py-0.5 rounded-full ml-2 flex-shrink-0', ps.badge)}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="flex gap-4 mb-2">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Now:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{rec.value}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Target:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{rec.target}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.action}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {analysis?.summary && (
        <div className={classNames('card p-5 border-l-4',
          profile.latest_risk_level==='Critical' ? 'border-red-500' :
          profile.latest_risk_level==='High'     ? 'border-orange-500' :
          profile.latest_risk_level==='Medium'   ? 'border-yellow-500' : 'border-green-500')}>
          <div className="flex items-start gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white bg-gradient-to-br ${RISK_GRAD[profile.latest_risk_level]||RISK_GRAD.Low}`}>
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wide text-slate-500 mb-1">AI Analysis Summary</div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{analysis.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* No issues */}
      {recs.length === 0 && !loading && (
        <div className="card p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="h-7 w-7 text-white" />
          </div>
          <p className="font-bold text-green-700 dark:text-green-400 text-lg">All Good! 🎉</p>
          <p className="text-slate-500 text-sm mt-1">No critical academic issues detected. Keep up the great work!</p>
        </div>
      )}
    </div>
  )
}
