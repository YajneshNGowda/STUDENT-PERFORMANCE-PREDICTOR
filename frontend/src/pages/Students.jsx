import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Plus, Upload, Download, Edit2, Trash2, Eye, ChevronUp,
  ChevronDown, RefreshCw, Filter, X, GraduationCap, FileText
} from 'lucide-react'
import { studentsAPI, deptsAPI } from '../utils/api'
import {
  PageLoader, RiskBadge, RiskBar, SearchInput, Select,
  Modal, ConfirmDialog, EmptyState, Pagination, ShapFactor, Spinner
} from '../components/ui/index.jsx'
import { DEPARTMENTS, SEMESTERS, SECTIONS, fmtNum, fmtPct, fmtDateTime, classNames, debounce } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

const PER_PAGE = 25

// ── Student Form ──────────────────────────────────────────────────────────────
function StudentForm({ student, depts, onSave, onClose, currentUser }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: student ? {
      ...student,
      extracurricular_participation: student.extracurricular_participation ? '1' : '0',
    } : {
      semester: 1, section: 'A', department_id: currentUser.department_id || '',
      extracurricular_participation: '0',
    }
  })

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      department_id: parseInt(data.department_id),
      semester: parseInt(data.semester),
      active_backlogs: parseInt(data.active_backlogs || 0),
      library_visits_per_month: parseInt(data.library_visits_per_month || 0),
      extracurricular_participation: data.extracurricular_participation === '1',
      attendance_pct: parseFloat(data.attendance_pct),
      internal_marks: parseFloat(data.internal_marks),
      assignment_submission_rate: parseFloat(data.assignment_submission_rate),
      prev_semester_cgpa: parseFloat(data.prev_semester_cgpa),
      lab_attendance_pct: parseFloat(data.lab_attendance_pct || 0),
      quiz_avg_score: parseFloat(data.quiz_avg_score || 0),
    }
    await onSave(payload)
  }

  const field = (label, name, opts = {}) => (
    <div key={name}>
      <label className="label">{label}</label>
      <input {...register(name, opts)} className="input"
        type={opts.type || 'text'} step={opts.step} min={opts.min} max={opts.max} />
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field('Student ID', 'student_id', { required: 'Required', disabled: !!student })}
        {field('Full Name', 'full_name', { required: 'Required' })}
        {field('Email', 'email', { type: 'email' })}
        {field('Phone', 'phone')}
        <div>
          <label className="label">Department</label>
          <select {...register('department_id', { required: true })} className="input">
            {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Semester</label>
            <select {...register('semester')} className="input">
              {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Section</label>
            <select {...register('section')} className="input">
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-t dark:border-slate-700 pt-3">Academic Performance</p>
      <div className="grid grid-cols-2 gap-3">
        {field('Attendance %', 'attendance_pct', { required: true, type: 'number', step: '0.1', min: '0', max: '100' })}
        {field('Internal Marks', 'internal_marks', { required: true, type: 'number', step: '0.1', min: '0', max: '100' })}
        {field('Assignment Rate %', 'assignment_submission_rate', { required: true, type: 'number', step: '0.1', min: '0', max: '100' })}
        {field('Prev CGPA', 'prev_semester_cgpa', { required: true, type: 'number', step: '0.01', min: '0', max: '10' })}
        {field('Lab Attendance %', 'lab_attendance_pct', { type: 'number', step: '0.1', min: '0', max: '100' })}
        {field('Quiz Avg Score', 'quiz_avg_score', { type: 'number', step: '0.1', min: '0', max: '100' })}
        {field('Library Visits/Month', 'library_visits_per_month', { type: 'number', min: '0', max: '30' })}
        {field('Active Backlogs', 'active_backlogs', { type: 'number', min: '0', max: '20' })}
        <div>
          <label className="label">Extracurricular</label>
          <select {...register('extracurricular_participation')} className="input">
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t dark:border-slate-700">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
          {isSubmitting ? <Spinner size="sm" /> : student ? 'Save Changes' : 'Add Student'}
        </button>
      </div>
    </form>
  )
}

// ── Student Detail Drawer ─────────────────────────────────────────────────────
function StudentDrawer({ student, onClose, onEdit }) {
  const [preds, setPreds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    studentsAPI.predictions(student.id).then(r => setPreds(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [student.id])

  const latest = preds[0]
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-surface-dark-secondary shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-surface-dark-secondary border-b border-surface-border dark:border-surface-dark-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{student.full_name}</h2>
            <p className="text-xs text-slate-500">{student.student_id} · {student.department_code} · Sem {student.semester}{student.section}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="btn-secondary text-xs gap-1.5"><Edit2 className="h-3.5 w-3.5" />Edit</button>
            <button onClick={onClose} className="btn-icon"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Risk status */}
          {latest && (
            <div className={classNames('p-4 rounded-xl border', latest.risk_level === 'Critical' ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' : latest.risk_level === 'High' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800' : 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800')}>
              <div className="flex items-center justify-between mb-2">
                <RiskBadge level={latest.risk_level} />
                <span className="text-sm font-bold font-mono">{fmtPct(latest.risk_probability * 100)}</span>
              </div>
              <RiskBar probability={latest.risk_probability} level={latest.risk_level} />
              <p className="text-xs text-slate-500 mt-2">Last updated: {fmtDateTime(latest.created_at)}</p>
            </div>
          )}

          {/* Academic metrics */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Academic Metrics</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Attendance', fmtPct(student.attendance_pct)],
                ['Internal Marks', `${fmtNum(student.internal_marks)}/100`],
                ['Assignment Rate', fmtPct(student.assignment_submission_rate)],
                ['CGPA', fmtNum(student.prev_semester_cgpa)],
                ['Lab Attendance', fmtPct(student.lab_attendance_pct)],
                ['Quiz Avg', `${fmtNum(student.quiz_avg_score)}/100`],
                ['Library Visits', `${student.library_visits_per_month}/mo`],
                ['Backlogs', student.active_backlogs],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg p-2.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SHAP explanations */}
          {latest?.top_risk_factors?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                Why Flagged — Top Risk Factors
              </h3>
              <div className="card p-4">
                {latest.top_risk_factors.slice(0, 5).map((f, i) => (
                  <ShapFactor key={i} {...f} />
                ))}
              </div>
            </div>
          )}

          {/* Prediction history */}
          {preds.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Prediction History</h3>
              <div className="space-y-1.5">
                {preds.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-surface-border/50 dark:border-surface-dark-border/50 text-xs">
                    <span className="text-slate-500">{fmtDateTime(p.created_at)}</span>
                    <RiskBadge level={p.risk_level} probability={p.risk_probability} showPct />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CSV Upload Modal ──────────────────────────────────────────────────────────
function CsvUploadModal({ open, onClose, depts, currentUser, onSuccess }) {
  const [file, setFile] = useState(null)
  const [deptId, setDeptId] = useState(currentUser?.department_id || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const doUpload = async () => {
    if (!file) return toast.error('Select a CSV file')
    setLoading(true)
    try {
      const { data } = await studentsAPI.bulkUpload(file, deptId || undefined)
      setResult(data)
      onSuccess()
      toast.success(`Imported ${data.created} students, updated ${data.updated}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const sampleCsv = `student_id,full_name,semester,section,attendance_pct,internal_marks,assignment_submission_rate,prev_semester_cgpa,lab_attendance_pct,quiz_avg_score,library_visits_per_month,extracurricular_participation,active_backlogs
1CS21001,Arjun Sharma,4,A,78.5,62.0,75.0,7.2,80.0,58.0,3,1,0
1CS21002,Priya Nair,4,A,45.0,35.0,42.0,5.1,50.0,30.0,1,0,3`

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'sample_students.csv'; a.click()
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk Upload Students" size="md">
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">CSV Format Required</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Upload triggers automatic risk prediction and alerts for all students.</p>
          <button onClick={downloadSample} className="mt-2 text-xs text-blue-700 dark:text-blue-400 underline flex items-center gap-1">
            <Download className="h-3 w-3" /> Download sample CSV
          </button>
        </div>

        <div>
          <label className="label">Department (override CSV column)</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)} className="input">
            <option value="">Use CSV department column</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">CSV File</label>
          <div className="border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-xl p-6 text-center hover:border-brand-400 transition-colors">
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} className="hidden" id="csv-input" />
            <label htmlFor="csv-input" className="cursor-pointer">
              <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {file ? <span className="text-brand-600 font-medium">{file.name}</span> : 'Click to select CSV'}
              </p>
            </label>
          </div>
        </div>

        {result && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
            ✅ Created: {result.created} · Updated: {result.updated}
            {result.errors?.length > 0 && <span className="text-orange-600"> · Errors: {result.errors.length}</span>}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={doUpload} disabled={loading || !file} className="btn-primary flex-1 justify-center">
            {loading ? <Spinner size="sm" /> : 'Upload & Predict'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const { user, isAdmin, canViewDept } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [students, setStudents] = useState([])
  const [depts, setDepts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [semFilter, setSemFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk_level') || '')
  const [sortBy, setSortBy] = useState('latest_risk_probability')
  const [sortDir, setSortDir] = useState('desc')

  const [addModal, setAddModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [viewStudent, setViewStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [uploadModal, setUploadModal] = useState(false)

  const debouncedSearch = useCallback(debounce(setSearch), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        skip: (page - 1) * PER_PAGE, limit: PER_PAGE,
        ...(search && { search }),
        ...(deptFilter && { dept_id: deptFilter }),
        ...(semFilter && { semester: semFilter }),
        ...(riskFilter && { risk_level: riskFilter }),
      }
      const [stuRes, deptRes] = await Promise.all([
        studentsAPI.list(params),
        deptsAPI.list(),
      ])
      setStudents(stuRes.data)
      setTotal(stuRes.data.length >= PER_PAGE ? page * PER_PAGE + 1 : (page - 1) * PER_PAGE + stuRes.data.length)
      setDepts(deptRes.data)
    } catch { toast.error('Failed to load students') }
    finally { setLoading(false) }
  }, [page, search, deptFilter, semFilter, riskFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleAdd = async (data) => {
    await studentsAPI.create(data)
    toast.success('Student added and risk predicted')
    setAddModal(false)
    loadData()
  }

  const handleEdit = async (data) => {
    await studentsAPI.update(editStudent.id, data)
    toast.success('Student updated and risk re-evaluated')
    setEditStudent(null)
    if (viewStudent) setViewStudent(null)
    loadData()
  }

  const handleDelete = async () => {
    await studentsAPI.delete(deleteTarget.id)
    toast.success('Student removed')
    setDeleteTarget(null)
    loadData()
  }

  const sorted = [...students].sort((a, b) => {
    const aVal = a[sortBy] ?? 0, bVal = b[sortBy] ?? 0
    return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
  })

  const SortTh = ({ col, label }) => (
    <th className="th cursor-pointer select-none" onClick={() => {
      if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else { setSortBy(col); setSortDir('desc') }
    }}>
      <span className="flex items-center gap-1">
        {label}
        {sortBy === col ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </span>
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} enrolled students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setUploadModal(true)} className="btn-secondary gap-2">
            <Upload className="h-4 w-4" /> Bulk Upload
          </button>
          <button onClick={() => setAddModal(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <SearchInput placeholder="Search name or ID…" onChange={debouncedSearch} className="w-56" />
        {canViewDept && (
          <Select value={deptFilter} onChange={v => { setDeptFilter(v); setPage(1) }}
            options={depts.map(d => ({ value: d.id, label: d.code }))}
            placeholder="All Depts" className="w-32" />
        )}
        <Select value={semFilter} onChange={v => { setSemFilter(v); setPage(1) }}
          options={SEMESTERS.map(s => ({ value: s, label: `Sem ${s}` }))}
          placeholder="All Sems" className="w-28" />
        <Select value={riskFilter} onChange={v => { setRiskFilter(v); setPage(1) }}
          options={['Critical','High','Medium','Low'].map(r => ({ value: r, label: r }))}
          placeholder="All Risk" className="w-28" />
        {(deptFilter || semFilter || riskFilter) && (
          <button onClick={() => { setDeptFilter(''); setSemFilter(''); setRiskFilter(''); setPage(1) }}
            className="btn-ghost gap-1 text-xs"><X className="h-3.5 w-3.5" /> Clear</button>
        )}
        <button onClick={loadData} className="ml-auto btn-icon" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <SortTh col="student_id"    label="Student ID" />
                <SortTh col="full_name"     label="Name" />
                <th className="th">Dept · Sem</th>
                <SortTh col="attendance_pct"    label="Attendance" />
                <SortTh col="internal_marks"    label="Marks" />
                <SortTh col="prev_semester_cgpa" label="CGPA" />
                <SortTh col="latest_risk_probability" label="Risk" />
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="td text-center py-12"><PageLoader /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={8} className="td">
                  <EmptyState icon={GraduationCap} title="No students found"
                    description="Try adjusting filters or add a new student"
                    action={<button onClick={() => setAddModal(true)} className="btn-primary">Add Student</button>} />
                </td></tr>
              ) : sorted.map(s => (
                <tr key={s.id} className="tr-hover">
                  <td className="td font-mono text-xs text-brand-600 dark:text-brand-400 font-semibold">{s.student_id}</td>
                  <td className="td font-medium text-slate-800 dark:text-slate-200">{s.full_name}</td>
                  <td className="td text-xs">
                    <span className="font-semibold">{s.department_code}</span> · Sem {s.semester}{s.section}
                  </td>
                  <td className="td text-sm">{fmtPct(s.attendance_pct)}</td>
                  <td className="td text-sm">{fmtNum(s.internal_marks)}</td>
                  <td className="td text-sm font-mono">{fmtNum(s.prev_semester_cgpa)}</td>
                  <td className="td">
                    {s.latest_risk_level ? (
                      <div className="space-y-1 min-w-[120px]">
                        <RiskBadge level={s.latest_risk_level} />
                        <RiskBar probability={s.latest_risk_probability} level={s.latest_risk_level} />
                      </div>
                    ) : <span className="text-xs text-slate-400">Pending</span>}
                  </td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button onClick={() => setViewStudent(s)} className="btn-icon p-1.5" title="View"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditStudent(s)} className="btn-icon p-1.5" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="btn-icon p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
      </div>

      {/* Modals */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New Student" size="lg">
        <StudentForm depts={depts} currentUser={user} onSave={handleAdd} onClose={() => setAddModal(false)} />
      </Modal>
      <Modal open={!!editStudent} onClose={() => setEditStudent(null)} title="Edit Student" size="lg">
        {editStudent && <StudentForm student={editStudent} depts={depts} currentUser={user}
          onSave={handleEdit} onClose={() => setEditStudent(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} danger
        title="Delete Student"
        message={`Are you sure you want to remove ${deleteTarget?.full_name}? This action cannot be undone.`} />
      <CsvUploadModal open={uploadModal} onClose={() => setUploadModal(false)}
        depts={depts} currentUser={user} onSuccess={loadData} />
      {viewStudent && (
        <StudentDrawer student={viewStudent} onClose={() => setViewStudent(null)}
          onEdit={() => { setEditStudent(viewStudent); setViewStudent(null) }} />
      )}
    </div>
  )
}
