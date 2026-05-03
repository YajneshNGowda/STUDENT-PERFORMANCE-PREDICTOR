import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Users, AlertTriangle, TrendingUp, Bell, BrainCircuit,
  ArrowRight, RefreshCw, CheckCircle, Clock, Sparkles, Activity,
  GraduationCap, ShieldAlert, BarChart2
} from 'lucide-react'
import { dashboardAPI } from '../utils/api'
import { StatCard, PageLoader, RiskBadge } from '../components/ui/index.jsx'
import { fmtNum, fmtDateTime, classNames } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const PIE_COLORS = {
  Critical: '#f43f5e',
  High:     '#fb923c',
  Medium:   '#facc15',
  Low:      '#4ade80',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-xl border-0 text-xs">
      <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</div>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{background:p.color}} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent=false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const { data:d } = await dashboardAPI.overview()
      setData(d)
    } catch { toast.error('Failed to load dashboard') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageLoader />

  const riskPie = ['Critical','High','Medium','Low'].map(k => ({
    name: k, value: data?.[`${k.toLowerCase()}_count`] || 0,
  })).filter(e => e.value > 0)

  const depts = (data?.departments || []).sort((a,b) => b.risk_pct - a.risk_pct)

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">👋</span>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {greeting()}, {user?.full_name?.split(' ')[0]}
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            {user?.department_code ? `${user.department_code} Department · ` : ''}
            {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="btn-secondary gap-2">
          <RefreshCw className={classNames('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── Model status banner ── */}
      {data?.model_f1 && (
        <div className="card px-5 py-3.5 flex items-center gap-4 flex-wrap"
          style={{background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.06))'}}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
            </div>
            <div className="flex items-center gap-1.5">
              <BrainCircuit className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">ML Model Active</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              F1: <strong className="text-slate-700 dark:text-slate-300 font-mono">{fmtNum(data.model_f1,4)}</strong>
            </span>
            <span className="flex items-center gap-1">
              AUC-ROC: <strong className="text-slate-700 dark:text-slate-300 font-mono">{fmtNum(data.model_auc,4)}</strong>
            </span>
            <span className="flex items-center gap-1">
              Last trained: <strong className="text-slate-700 dark:text-slate-300">{fmtDateTime(data.last_model_trained)}</strong>
            </span>
          </div>
          <Link to="/model" className="ml-auto btn-ghost text-xs gap-1 text-brand-600 dark:text-brand-400">
            View metrics <ArrowRight className="h-3 w-3"/>
          </Link>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
        <StatCard label="Total Students"   value={data?.total_students??0} icon={Users}        color="blue"   sub="Active enrollments" />
        <StatCard label="At Risk"          value={data?.at_risk_count??0}  icon={AlertTriangle} color="red"    sub={`${fmtNum(data?.at_risk_pct,1)}% of class`} />
        <StatCard label="Critical"         value={data?.critical_count??0} icon={ShieldAlert}   color="red"    sub="Need immediate help" />
        <StatCard label="High Risk"        value={data?.high_count??0}     icon={TrendingUp}    color="orange" sub="Monitor closely" />
        <StatCard label="Alerts Today"     value={data?.total_alerts_today??0} icon={Bell}      color="purple" sub="Auto-generated" />
        <StatCard label="Unacknowledged"   value={data?.unacknowledged_alerts??0} icon={Clock}  color="yellow" sub="Pending review" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Donut chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Risk Distribution</h3>
            <BarChart2 className="h-4 w-4 text-slate-400" />
          </div>
          {riskPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={riskPie} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                    paddingAngle={3} dataKey="value" strokeWidth={2} stroke="transparent">
                    {riskPie.map(e => <Cell key={e.name} fill={PIE_COLORS[e.name]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip/>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {riskPie.map(e => (
                  <div key={e.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{background:PIE_COLORS[e.name]}} />
                    <span className="text-slate-500">{e.name}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 ml-auto">{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No prediction data yet</div>
          )}
        </div>

        {/* Area trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">7-Day At-Risk Trend</h3>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.risk_trend||[]} margin={{top:5,right:5,bottom:0,left:-25}}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip/>} />
              <Area type="monotone" dataKey="at_risk" name="At-Risk Students"
                stroke="#6366f1" strokeWidth={2.5} fill="url(#areaGrad)" dot={{r:4,fill:'#6366f1',strokeWidth:0}} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Department breakdown ── */}
      {depts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Department Risk Overview</h3>
            <Link to="/departments" className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1">
              All departments <ArrowRight className="h-3 w-3"/>
            </Link>
          </div>
          <div className="space-y-3">
            {depts.map(dept => {
              const color = dept.risk_pct > 30 ? '#f43f5e' : dept.risk_pct > 15 ? '#fb923c' : '#4f46e5'
              return (
                <div key={dept.code} className="flex items-center gap-4">
                  <div className="w-10 flex-shrink-0">
                    <div className="text-xs font-black text-slate-600 dark:text-slate-400 text-right">{dept.code}</div>
                  </div>
                  <div className="flex-1 relative h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 flex items-center"
                      style={{width:`${Math.max(dept.risk_pct,2)}%`, background:`linear-gradient(90deg,${color}cc,${color})`}}>
                    </div>
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {dept.at_risk}/{dept.total} at risk
                      </span>
                    </div>
                  </div>
                  <div className="w-12 text-right">
                    <span className="text-xs font-black" style={{color}}>{dept.risk_pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="grid sm:grid-cols-3 gap-4 stagger-children">
        {[
          {
            to:'/students?risk_level=Critical',
            gradient:'from-red-500 to-rose-500',
            icon:AlertTriangle,
            title:'Critical Students',
            desc:`${data?.critical_count||0} need immediate intervention`,
            cta:'View now',
          },
          {
            to:'/alerts',
            gradient:'from-orange-500 to-amber-500',
            icon:Bell,
            title:'Pending Alerts',
            desc:`${data?.unacknowledged_alerts||0} unacknowledged alerts`,
            cta:'Review',
          },
          {
            to:'/model',
            gradient:'from-brand-600 to-violet-600',
            icon:BrainCircuit,
            title:'Model Insights',
            desc: data?.model_f1 ? `F1 = ${fmtNum(data.model_f1,4)} · AUC = ${fmtNum(data.model_auc,4)}` : 'View ML performance',
            cta:'Explore',
          },
        ].map(({to,gradient,icon:Icon,title,desc,cta}) => (
          <Link key={to} to={to}
            className="card-hover p-5 group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-8 -translate-y-1/2 translate-x-1/2 bg-gradient-to-br ${gradient}`} />
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br ${gradient} mb-3 shadow-md`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3 leading-relaxed">{desc}</div>
            <div className={`text-xs font-bold bg-gradient-to-r ${gradient} bg-clip-text`} style={{WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              {cta} →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
