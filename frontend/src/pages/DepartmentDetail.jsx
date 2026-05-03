/**
 * Department Detail Page
 * Shows full department overview: stats, risk breakdown, student list with risk levels.
 * Route: /departments/:code
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, GraduationCap, AlertTriangle, Users,
  Activity, Eye, TrendingUp, Building2, RefreshCw,
  Award, BookOpen, CheckCircle
} from 'lucide-react'
import { studentsAPI, deptsAPI } from '../utils/api'
import {
  PageLoader, RiskBadge, RiskBar, EmptyState, Spinner
} from '../components/ui/index.jsx'
import { fmtNum, fmtPct, classNames } from '../utils/helpers'

const DEPT_ICONS = { CS:'💻', IS:'🔍', EC:'📡', EE:'⚡', ME:'⚙️', CG:'🎨' }
const DEPT_GRADIENTS = {
  CS:'from-blue-500 to-indigo-600',
  IS:'from-violet-500 to-purple-600',
  EC:'from-emerald-500 to-teal-600',
  EE:'from-orange-500 to-amber-500',
  ME:'from-rose-500 to-pink-600',
  CG:'from-cyan-500 to-blue-500',
}

const RISK_COLORS = {
  Critical: { bg:'bg-red-50 dark:bg-red-900/15',    text:'text-red-700 dark:text-red-300',    border:'border-red-200 dark:border-red-800',    bar:'bg-red-500',    count:0 },
  High:     { bg:'bg-orange-50 dark:bg-orange-900/15', text:'text-orange-700 dark:text-orange-300', border:'border-orange-200 dark:border-orange-800', bar:'bg-orange-500', count:0 },
  Medium:   { bg:'bg-yellow-50 dark:bg-yellow-900/15', text:'text-yellow-700 dark:text-yellow-300', border:'border-yellow-200 dark:border-yellow-800', bar:'bg-yellow-500', count:0 },
  Low:      { bg:'bg-green-50 dark:bg-green-900/15',   text:'text-green-700 dark:text-green-300',   border:'border-green-200 dark:border-green-800',   bar:'bg-green-500',  count:0 },
}

export default function DepartmentDetailPage() {
  const { code }                  = useParams()
  const [dept,       setDept]     = useState(null)
  const [students,   setStudents] = useState([])
  const [loading,    setLoading]  = useState(true)
  const [semFilter,  setSemFilter]= useState('')
  const [riskFilter, setRiskFilter]=useState('')
  const [search,     setSearch]   = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [dRes, sRes] = await Promise.all([
        deptsAPI.list(),
        studentsAPI.list({ limit: 500 }),
      ])
      const foundDept = dRes.data.find(d => d.code === code.toUpperCase())
      if (!foundDept) { toast.error('Department not found'); setLoading(false); return }
      setDept(foundDept)

      const deptStudents = sRes.data.filter(s => s.department_code === code.toUpperCase())
      setStudents(deptStudents)
    } catch { toast.error('Failed to load department') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [code])

  if (loading) return <PageLoader />
  if (!dept)   return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Department not found.</p>
        <Link to="/departments" className="btn-secondary mt-4">← Back</Link>
      </div>
    </div>
  )

  const grad = DEPT_GRADIENTS[code.toUpperCase()] || 'from-brand-500 to-violet-600'

  // Risk breakdown
  const riskCounts = { Critical:0, High:0, Medium:0, Low:0, None:0 }
  students.forEach(s => {
    const lvl = s.latest_risk_level
    if (lvl && riskCounts[lvl] !== undefined) riskCounts[lvl]++
    else riskCounts.None++
  })
  const atRisk    = riskCounts.Critical + riskCounts.High
  const riskPct   = students.length ? ((atRisk / students.length) * 100).toFixed(1) : 0
  const avgAttend = students.length ? (students.reduce((a,s)=>a+s.attendance_pct,0)/students.length).toFixed(1) : 0
  const avgMarks  = students.length ? (students.reduce((a,s)=>a+s.internal_marks,0)/students.length).toFixed(1) : 0
  const avgCgpa   = students.length ? (students.reduce((a,s)=>a+s.prev_semester_cgpa,0)/students.length).toFixed(2) : 0

  // Semester breakdown
  const semBreakdown = {}
  students.forEach(s => {
    if (!semBreakdown[s.semester]) semBreakdown[s.semester] = { total:0, atRisk:0 }
    semBreakdown[s.semester].total++
    if (['Critical','High'].includes(s.latest_risk_level)) semBreakdown[s.semester].atRisk++
  })

  // Filtered students
  const filtered = students.filter(s => {
    if (semFilter  && String(s.semester)   !== semFilter)  return false
    if (riskFilter && s.latest_risk_level  !== riskFilter) return false
    if (search     && !s.full_name.toLowerCase().includes(search.toLowerCase())
                   && !s.usn?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a,b) => (b.latest_risk_probability||0) - (a.latest_risk_probability||0))

  const semesters = [...new Set(students.map(s=>s.semester))].sort()

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/departments"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors group">
          <div className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-brand-400 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          Departments
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{dept.name}</span>
        <button onClick={load} className="ml-auto btn-ghost p-1.5">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Hero card */}
      <div className="card overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${grad}`} />
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-3xl shadow-xl`}>
                {DEPT_ICONS[code.toUpperCase()] || '🏫'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white">{dept.code}</h1>
                  <span className={classNames('text-xs font-bold px-2.5 py-1 rounded-full',
                    riskPct > 30 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    riskPct > 15 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
                    {riskPct > 30 ? 'High Risk Dept' : riskPct > 15 ? 'Moderate Risk' : 'Low Risk'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">{dept.name}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label:'Total Students', value:students.length, icon:Users,          color:'text-brand-600 dark:text-brand-400',   bg:'bg-brand-50 dark:bg-brand-900/20' },
              { label:'At Risk',        value:atRisk,          icon:AlertTriangle,  color:'text-red-600 dark:text-red-400',      bg:'bg-red-50 dark:bg-red-900/20' },
              { label:'Risk Rate',      value:`${riskPct}%`,   icon:TrendingUp,     color:'text-orange-600 dark:text-orange-400',bg:'bg-orange-50 dark:bg-orange-900/20' },
              { label:'Avg CGPA',       value:avgCgpa,         icon:Award,          color:'text-green-600 dark:text-green-400',  bg:'bg-green-50 dark:bg-green-900/20' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className={classNames('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
                  <s.icon className={classNames('h-5 w-5', s.color)} />
                </div>
                <div>
                  <div className={classNames('text-xl font-black', s.color)}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk level breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(RISK_COLORS).map(([level, cfg]) => (
          <button key={level}
            onClick={() => setRiskFilter(riskFilter === level ? '' : level)}
            className={classNames(
              'card p-4 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              riskFilter === level ? 'ring-2 ring-brand-500' : ''
            )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={classNames('h-3 w-3 rounded-full', cfg.bar)} />
              <span className={classNames('text-xs font-bold uppercase tracking-wide', cfg.text)}>{level}</span>
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{riskCounts[level]}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {students.length ? ((riskCounts[level]/students.length)*100).toFixed(1) : 0}% of dept
            </div>
          </button>
        ))}
      </div>

      {/* Semester breakdown */}
      {Object.keys(semBreakdown).length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-brand-500" />
            Risk by Semester
          </h3>
          <div className="space-y-2.5">
            {Object.entries(semBreakdown).sort(([a],[b])=>Number(a)-Number(b)).map(([sem, data]) => {
              const pct = data.total ? (data.atRisk/data.total*100) : 0
              const color = pct>30?'bg-red-500':pct>15?'bg-orange-500':'bg-brand-500'
              return (
                <div key={sem} className="flex items-center gap-3">
                  <button
                    onClick={() => setSemFilter(semFilter===sem?'':sem)}
                    className={classNames(
                      'text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0',
                      semFilter===sem
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-400'
                    )}>
                    Sem {sem}
                  </button>
                  <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                    <div className={classNames('h-full rounded-xl transition-all duration-700', color)}
                      style={{width:`${Math.max(pct,2)}%`, opacity:0.85}} />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {data.atRisk}/{data.total} at risk
                    </span>
                  </div>
                  <span className="text-xs font-black w-14 text-right"
                    style={{color:pct>30?'#ef4444':pct>15?'#f97316':'#22c55e'}}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Student table */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-500" />
            Students ({filtered.length})
          </h3>
          <div className="flex gap-2 flex-wrap">
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search name or USN…"
              className="input text-xs h-8 py-1 w-44" />
            <select value={semFilter} onChange={e=>setSemFilter(e.target.value)} className="input text-xs h-8 py-1 w-28">
              <option value="">All Sems</option>
              {semesters.map(s=><option key={s} value={s}>Sem {s}</option>)}
            </select>
            {(semFilter||riskFilter||search) && (
              <button onClick={()=>{setSemFilter('');setRiskFilter('');setSearch('')}}
                className="btn-ghost text-xs h-8 px-3">Clear</button>
            )}
          </div>
        </div>

        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th">USN</th>
                  <th className="th">Name</th>
                  <th className="th">Sem · Sec</th>
                  <th className="th">Attendance</th>
                  <th className="th">Marks</th>
                  <th className="th">CGPA</th>
                  <th className="th">Backlogs</th>
                  <th className="th">Risk</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="td">
                    <EmptyState icon={GraduationCap} title="No students found"
                      description="Try changing the filters above." />
                  </td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="tr-hover">
                    <td className="td">
                      <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                        {s.usn || s.student_id}
                      </span>
                    </td>
                    <td className="td font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                    <td className="td text-xs text-slate-500">Sem {s.semester} · {s.section}</td>
                    <td className="td text-sm">
                      <span className={s.attendance_pct<75?'text-red-600 font-bold':''}>{fmtPct(s.attendance_pct)}</span>
                    </td>
                    <td className="td text-sm">
                      <span className={s.internal_marks<40?'text-red-600 font-bold':''}>{fmtNum(s.internal_marks,1)}</span>
                    </td>
                    <td className="td text-sm font-mono">{fmtNum(s.prev_semester_cgpa,2)}</td>
                    <td className="td text-sm">
                      {s.active_backlogs > 0 ? (
                        <span className="text-red-600 font-bold">{s.active_backlogs}</span>
                      ) : <span className="text-green-600">0</span>}
                    </td>
                    <td className="td">
                      {s.latest_risk_level ? (
                        <div className="space-y-1 min-w-[110px]">
                          <RiskBadge level={s.latest_risk_level} />
                          <RiskBar probability={s.latest_risk_probability} level={s.latest_risk_level} />
                        </div>
                      ) : <span className="text-xs text-slate-400">Pending</span>}
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        <Link to={`/students/${s.id}/risk`}
                          className="btn-icon p-1.5 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20" title="Risk Analysis">
                          <Activity className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance averages */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-500" />
          Department Performance Averages
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label:'Avg Attendance',     value:`${avgAttend}%`,   ok: Number(avgAttend)>=75 },
            { label:'Avg Internal Marks', value:`${avgMarks}/100`, ok: Number(avgMarks)>=40 },
            { label:'Avg CGPA',           value:avgCgpa,            ok: Number(avgCgpa)>=5 },
            { label:'Avg Quiz Score',     value:`${students.length?(students.reduce((a,s)=>a+s.quiz_avg_score,0)/students.length).toFixed(1):0}/100`, ok:true },
            { label:'Avg Lab Attendance', value:`${students.length?(students.reduce((a,s)=>a+s.lab_attendance_pct,0)/students.length).toFixed(1):0}%`, ok:true },
            { label:'Students at Risk',   value:`${atRisk} / ${students.length}`, ok: atRisk===0 },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className={classNames('h-2.5 w-2.5 rounded-full flex-shrink-0', m.ok?'bg-green-500':'bg-red-500')} />
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{m.label}</div>
                <div className={classNames('font-black text-base', m.ok?'text-green-600 dark:text-green-400':'text-red-600 dark:text-red-400')}>{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
