import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, AlertTriangle, ArrowRight } from 'lucide-react'
import { deptsAPI } from '../utils/api'
import { PageLoader, StatCard } from '../components/ui/index.jsx'
import { classNames } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function DepartmentsPage() {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    deptsAPI.list().then(r => setDepts(r.data)).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const totalStudents = depts.reduce((a, d) => a + (d.student_count || 0), 0)
  const totalAtRisk   = depts.reduce((a, d) => a + (d.at_risk_count || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Departments</h1>
        <p className="text-sm text-slate-500">{depts.length} departments · {totalStudents} students</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={totalStudents} icon={Users} color="blue" />
        <StatCard label="At Risk" value={totalAtRisk} icon={AlertTriangle} color="red"
          sub={`${totalStudents ? ((totalAtRisk/totalStudents)*100).toFixed(1) : 0}% of total`} />
        <StatCard label="Departments" value={depts.length} icon={Building2} color="purple" />
        <StatCard label="Avg Risk Rate"
          value={`${depts.length ? (depts.reduce((a,d) => a + (d.student_count ? d.at_risk_count/d.student_count*100 : 0), 0) / depts.length).toFixed(1) : 0}%`}
          color="orange" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {depts.map(d => {
          const riskPct = d.student_count ? (d.at_risk_count / d.student_count * 100) : 0
          const riskColor = riskPct > 25 ? 'red' : riskPct > 15 ? 'orange' : 'green'
          return (
            <Link key={d.id} to={`/students?dept_id=${d.id}`}
              className="card-hover p-5 group flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                  <span className="text-brand-700 dark:text-brand-400 font-bold text-sm">{d.code}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{d.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{d.student_count || 0} students</div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">At Risk</span>
                  <span className={classNames('font-semibold',
                    riskPct > 25 ? 'text-red-600' : riskPct > 15 ? 'text-orange-600' : 'text-green-600')}>
                    {d.at_risk_count || 0} ({riskPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={classNames('h-full rounded-full transition-all',
                    riskPct > 25 ? 'bg-red-500' : riskPct > 15 ? 'bg-orange-500' : 'bg-green-500')}
                    style={{ width: `${Math.min(riskPct, 100)}%` }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
