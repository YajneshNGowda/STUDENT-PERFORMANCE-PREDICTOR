import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, AlertTriangle, ArrowRight, TrendingUp, GraduationCap } from 'lucide-react'
import { deptsAPI } from '../utils/api'
import { PageLoader, StatCard } from '../components/ui/index.jsx'
import { classNames } from '../utils/helpers'
import toast from 'react-hot-toast'

const DEPT_ICONS = {
  CS: '💻', IS: '🔍', EC: '📡', EE: '⚡', ME: '⚙️', CG: '🎨',
}

const DEPT_GRADIENTS = [
  'from-blue-500   to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-rose-500   to-pink-600',
  'from-cyan-500   to-blue-500',
]

export default function DepartmentsPage() {
  const [depts,   setDepts]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    deptsAPI.list()
      .then(r => setDepts(r.data))
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const totalStudents = depts.reduce((a, d) => a + (d.student_count || 0), 0)
  const totalAtRisk   = depts.reduce((a, d) => a + (d.at_risk_count  || 0), 0)
  const avgRisk       = depts.length
    ? (depts.reduce((a, d) => a + (d.student_count ? d.at_risk_count / d.student_count * 100 : 0), 0) / depts.length).toFixed(1)
    : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Departments</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {depts.length} departments · {totalStudents} total students
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={totalStudents}    icon={GraduationCap} color="blue" />
        <StatCard label="At Risk"        value={totalAtRisk}      icon={AlertTriangle} color="red"
          sub={totalStudents ? `${((totalAtRisk/totalStudents)*100).toFixed(1)}% of all students` : '0%'} />
        <StatCard label="Departments"    value={depts.length}     icon={Building2}     color="purple" />
        <StatCard label="Avg Risk Rate"  value={`${avgRisk}%`}   icon={TrendingUp}    color="orange" />
      </div>

      {/* Department cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {depts.map((dept, idx) => {
          const riskPct    = dept.student_count ? (dept.at_risk_count / dept.student_count * 100) : 0
          const gradient   = DEPT_GRADIENTS[idx % DEPT_GRADIENTS.length]
          const riskColor  = riskPct > 30 ? '#ef4444' : riskPct > 15 ? '#f97316' : '#22c55e'
          const riskLabel  = riskPct > 30 ? 'High Risk' : riskPct > 15 ? 'Moderate' : 'Safe'
          const riskBadgeCls = riskPct > 30
            ? 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400'
            : riskPct > 15
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400'

          return (
            <Link key={dept.id} to={`/departments/${dept.code}`}
              className="card-hover group overflow-hidden">

              {/* Gradient top bar */}
              <div className={`h-2 bg-gradient-to-r ${gradient}`} />

              <div className="p-5">
                {/* Dept header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-md flex-shrink-0`}>
                      {DEPT_ICONS[dept.code] || '🏫'}
                    </div>
                    <div>
                      <div className="font-black text-slate-800 dark:text-slate-100 text-base">{dept.code}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{dept.name}</div>
                    </div>
                  </div>
                  <div className={classNames('badge text-xs', riskBadgeCls)}>
                    {riskLabel}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{dept.student_count || 0}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Total Students</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-center"
                    style={{background: riskPct > 15 ? `rgba(239,68,68,0.06)` : undefined}}>
                    <div className="text-2xl font-black" style={{color: riskColor}}>{dept.at_risk_count || 0}</div>
                    <div className="text-xs text-slate-500 mt-0.5">At Risk</div>
                  </div>
                </div>

                {/* Risk bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-500">Risk Rate</span>
                    <span className="text-xs font-black" style={{color: riskColor}}>{riskPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(riskPct, 100)}%`,
                        background: `linear-gradient(90deg, ${riskColor}99, ${riskColor})`,
                      }} />
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Click to view students</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 group-hover:gap-2 transition-all">
                    View Students <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Overall risk bar chart */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-5">At-Risk % Comparison Across Departments</h3>
        <div className="space-y-3">
          {depts
            .sort((a, b) => {
              const ar = a.student_count ? a.at_risk_count / a.student_count * 100 : 0
              const br = b.student_count ? b.at_risk_count / b.student_count * 100 : 0
              return br - ar
            })
            .map((dept, idx) => {
              const riskPct   = dept.student_count ? (dept.at_risk_count / dept.student_count * 100) : 0
              const riskColor = riskPct > 30 ? '#ef4444' : riskPct > 15 ? '#f97316' : '#6366f1'
              const gradient  = DEPT_GRADIENTS[depts.indexOf(dept) % DEPT_GRADIENTS.length]
              return (
                <div key={dept.id} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-sm flex-shrink-0`}>
                    {DEPT_ICONS[dept.code] || '🏫'}
                  </div>
                  <div className="w-10 flex-shrink-0 text-xs font-black text-slate-600 dark:text-slate-400">{dept.code}</div>
                  <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                    <div className="h-full rounded-xl transition-all duration-700 flex items-center"
                      style={{
                        width: `${Math.max(riskPct, 3)}%`,
                        background: `linear-gradient(90deg, ${riskColor}99, ${riskColor})`,
                      }} />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {dept.at_risk_count} / {dept.student_count} at risk
                      </span>
                    </div>
                  </div>
                  <div className="w-14 text-right flex-shrink-0">
                    <span className="text-sm font-black" style={{color: riskColor}}>{riskPct.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
