import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Users, AlertTriangle, TrendingUp, Bell, BrainCircuit,
  ArrowRight, RefreshCw, CheckCircle, Clock
} from 'lucide-react'
import { dashboardAPI } from '../utils/api'
import { StatCard, PageLoader, RiskBadge } from '../components/ui/index.jsx'
import { fmtNum, fmtDateTime, CHART_COLORS } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const PIE_COLORS = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' }

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { data: d } = await dashboardAPI.overview()
      setData(d)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageLoader />

  const riskPie = Object.entries({
    Critical: data?.critical_count || 0,
    High: data?.high_count || 0,
    Medium: data?.medium_count || 0,
    Low: data?.low_count || 0,
  }).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Welcome back, {user?.full_name?.split(' ')[0]}
            {user?.department_code ? ` · ${user.department_code} Department` : ''}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="btn-secondary gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard label="Total Students" value={data?.total_students ?? 0}
          icon={Users} color="blue" sub="Active enrollments" />
        <StatCard label="At Risk" value={data?.at_risk_count ?? 0}
          icon={AlertTriangle} color="red"
          sub={`${fmtNum(data?.at_risk_pct, 1)}% of class`} />
        <StatCard label="Critical" value={data?.critical_count ?? 0}
          icon={AlertTriangle} color="red" sub="Immediate action" />
        <StatCard label="High Risk" value={data?.high_count ?? 0}
          icon={TrendingUp} color="orange" sub="Monitor closely" />
        <StatCard label="Alerts Today" value={data?.total_alerts_today ?? 0}
          icon={Bell} color="purple" sub="Auto-generated" />
        <StatCard label="Unacknowledged" value={data?.unacknowledged_alerts ?? 0}
          icon={Clock} color="yellow" sub="Pending review" />
      </div>

      {/* Model status banner */}
      {data?.model_f1 && (
        <div className="card px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse-soft" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ML Model Active</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>F1: <strong className="text-slate-700 dark:text-slate-300 font-mono">{fmtNum(data.model_f1, 4)}</strong></span>
            <span>AUC-ROC: <strong className="text-slate-700 dark:text-slate-300 font-mono">{fmtNum(data.model_auc, 4)}</strong></span>
            <span>Last trained: <strong className="text-slate-700 dark:text-slate-300">{fmtDateTime(data.last_model_trained)}</strong></span>
          </div>
          <Link to="/model" className="ml-auto btn-ghost text-xs gap-1">
            View details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Risk distribution pie */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false}>
                {riskPie.map(e => <Cell key={e.name} fill={PIE_COLORS[e.name]} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Students']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 7-day trend */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-4">7-Day At-Risk Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.risk_trend || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="at_risk" stroke="#3b82f6" strokeWidth={2}
                fill="url(#riskGrad)" name="At-Risk Students" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department breakdown */}
      {data?.departments?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Department Risk Overview</h3>
            <Link to="/departments" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3">
            {data.departments.sort((a, b) => b.risk_pct - a.risk_pct).map(dept => (
              <div key={dept.code} className="flex items-center gap-3">
                <div className="w-12 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">{dept.code}</div>
                <div className="flex-1 h-6 bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-lg overflow-hidden relative">
                  <div className="h-full rounded-lg transition-all duration-700"
                    style={{
                      width: `${dept.risk_pct || 0}%`,
                      background: dept.risk_pct > 30 ? '#ef4444' : dept.risk_pct > 15 ? '#f97316' : '#3b82f6',
                      opacity: 0.8,
                    }} />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {dept.at_risk}/{dept.total} at risk ({dept.risk_pct}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { to: '/students?risk_level=Critical', icon: AlertTriangle, color: 'red',    title: 'Critical Students', desc: `${data?.critical_count || 0} need immediate intervention` },
          { to: '/alerts',                       icon: Bell,           color: 'orange', title: 'Pending Alerts',   desc: `${data?.unacknowledged_alerts || 0} unacknowledged alerts` },
          { to: '/model',                        icon: BrainCircuit,   color: 'blue',   title: 'Model Metrics',    desc: data?.model_f1 ? `F1 = ${fmtNum(data.model_f1, 4)}` : 'View performance' },
        ].map(({ to, icon: Icon, color, title, desc }) => (
          <Link key={to} to={to}
            className="card-hover p-4 flex items-center gap-3 group">
            <div className={`p-2.5 rounded-lg bg-${color}-50 dark:bg-${color}-900/20`}>
              <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{desc}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
