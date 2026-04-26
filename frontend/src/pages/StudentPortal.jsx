/**
 * Student + Parent self-service portal.
 * Read-only view of their own academic data + individual risk analysis.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine
} from 'recharts'
import { GraduationCap, AlertTriangle, TrendingUp, BookOpen,
         CheckCircle, Clock, Users, BarChart2, Award, RefreshCw } from 'lucide-react'
import { studentsAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { PageLoader, RiskBadge, ShapFactor } from '../components/ui/index.jsx'
import { fmtNum, fmtPct, fmtDateTime, classNames, CONDITION_LABELS, CONDITION_COLORS, getRiskConfig } from '../utils/helpers'

const PRIORITY_COLOR = { HIGH:'text-red-600 dark:text-red-400', MEDIUM:'text-orange-600 dark:text-orange-400', LOW:'text-yellow-600 dark:text-yellow-400' }
const PRIORITY_BG    = { HIGH:'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', MEDIUM:'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', LOW:'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' }

function MetricCard({ label, value, max, unit='', color='blue', icon:Icon, warn }) {
  const pct = max ? Math.min((parseFloat(value)/max)*100,100) : null
  const colorMap = {
    blue:   'stroke-brand-500', green:'stroke-green-500', red:'stroke-red-500',
    orange: 'stroke-orange-500', yellow:'stroke-yellow-500',
  }
  return (
    <div className={classNames('card p-4 flex flex-col gap-2', warn && 'border-red-300 dark:border-red-700')}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        {value}{unit}
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={classNames('h-full rounded-full transition-all', pct<50?'bg-red-500':pct<75?'bg-yellow-500':'bg-green-500')}
            style={{width:`${pct}%`}} />
        </div>
      )}
      {warn && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> {warn}</p>}
    </div>
  )
}

export default function StudentPortal() {
  const { user, isParent } = useAuth()
  const [profile, setProfile] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
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
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load profile')
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  if (loading) return <PageLoader />
  if (!profile) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500">No student profile found. Contact your administrator.</p>
    </div>
  )

  const riskCfg = getRiskConfig(profile.latest_risk_level || 'Low')
  const riskPct = Math.round((profile.latest_risk_probability || 0) * 100)
  const trend   = analysis?.prediction_trend || []

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header banner */}
      <div className={classNames('card p-6 border-2', riskCfg.border, riskCfg.bg)}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-800 shadow flex items-center justify-center text-xl font-bold text-brand-600">
              {profile.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.full_name}</h1>
              <p className="text-sm text-slate-500">USN: <span className="font-mono font-semibold">{profile.usn}</span>
                {' · '}{profile.department_name} · Semester {profile.semester}{profile.section}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Batch: {profile.batch_year || '—'} · {isParent ? "Parent View" : "Student View"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile.latest_risk_level && (
              <div className={classNames('px-4 py-2 rounded-xl border-2 text-center', riskCfg.border, riskCfg.bg)}>
                <div className={classNames('text-2xl font-bold', riskCfg.color)}>{riskPct}%</div>
                <RiskBadge level={profile.latest_risk_level} />
              </div>
            )}
            <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost">
              <RefreshCw className={`h-4 w-4 ${refreshing?'animate-spin':''}`} />
            </button>
          </div>
        </div>
        {profile.alert_conditions?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.alert_conditions.map(c => (
              <span key={c} className={classNames('badge text-xs', CONDITION_COLORS[c] || 'bg-slate-100 text-slate-600')}>
                ⚠ {CONDITION_LABELS[c] || c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Academic metrics grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Academic Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Attendance"    value={fmtNum(profile.attendance_pct,1)} unit="%" max={100}
            icon={Users}    warn={profile.attendance_pct<75 ? 'Below 75% minimum':''}
            color={profile.attendance_pct>=75?'green':'red'} />
          <MetricCard label="Internal Marks" value={fmtNum(profile.internal_marks,1)} unit="/100" max={100}
            icon={BookOpen} warn={profile.internal_marks<40 ? 'Below passing threshold':''}
            color={profile.internal_marks>=40?'green':'red'} />
          <MetricCard label="Assignment Rate" value={fmtNum(profile.assignment_submission_rate,1)} unit="%" max={100}
            icon={CheckCircle} color={profile.assignment_submission_rate>=70?'green':'orange'} />
          <MetricCard label="CGPA"          value={fmtNum(profile.prev_semester_cgpa,2)} max={10}
            icon={Award}   color={profile.prev_semester_cgpa>=6?'green':'orange'}
            warn={profile.prev_semester_cgpa<5 && profile.prev_semester_cgpa>0 ? 'Low CGPA':''} />
          <MetricCard label="Lab Attendance" value={fmtNum(profile.lab_attendance_pct,1)} unit="%" max={100}
            icon={TrendingUp} color={profile.lab_attendance_pct>=75?'green':'orange'} />
          <MetricCard label="Quiz Avg"      value={fmtNum(profile.quiz_avg_score,1)} unit="/100" max={100}
            icon={BarChart2} color={profile.quiz_avg_score>=50?'green':'orange'} />
          <MetricCard label="Library Visits" value={profile.library_visits_per_month} unit="/mo"
            icon={BookOpen} color="blue" />
          <MetricCard label="Active Backlogs" value={profile.active_backlogs}
            icon={AlertTriangle} color={profile.active_backlogs===0?'green':profile.active_backlogs<3?'orange':'red'}
            warn={profile.active_backlogs>=2?`${profile.active_backlogs} backlog(s) pending`:''} />
        </div>
      </div>

      {/* Risk trend + SHAP side by side */}
      {analysis && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Risk trend chart */}
          {trend.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Score Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{top:5,right:10,bottom:0,left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{fontSize:10}} />
                  <YAxis domain={[0,100]} tick={{fontSize:10}} />
                  <Tooltip formatter={v=>[`${v}%`,'Risk Score']} />
                  <ReferenceLine y={55} stroke="#f97316" strokeDasharray="4 4" label={{value:'High',position:'right',fontSize:9}} />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label={{value:'Critical',position:'right',fontSize:9}} />
                  <Line type="monotone" dataKey="risk_probability" stroke="#3b82f6" strokeWidth={2.5} dot={{r:4}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SHAP factors */}
          {analysis.risk_analysis?.top_risk_factors?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                What's Affecting Your Risk Score
              </h2>
              {analysis.risk_analysis.top_risk_factors.slice(0,5).map((f,i) => (
                <ShapFactor key={i} {...f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {analysis?.recommendations?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            Personalised Recommendations
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className={classNames('card p-4 border', PRIORITY_BG[rec.priority])}>
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{rec.issue}</div>
                  <span className={classNames('text-xs font-bold', PRIORITY_COLOR[rec.priority])}>
                    {rec.priority}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <span>Current: <strong className="text-slate-800 dark:text-slate-200">{rec.value}</strong></span>
                  <span>Target: <strong className="text-green-600">{rec.target}</strong></span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {analysis?.summary && (
        <div className={classNames('card p-4 border-l-4', riskCfg.border)}>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>Summary:</strong> {analysis.summary}
          </p>
          {profile.latest_risk_level && ['High','Critical'].includes(profile.latest_risk_level) && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
              ⚠ Your faculty and parent/guardian have been automatically notified about your academic status.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
