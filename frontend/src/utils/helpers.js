export const RISK_CONFIG = {
  Critical:{color:'text-red-600 dark:text-red-400',    bg:'bg-red-50 dark:bg-red-900/20',    border:'border-red-200 dark:border-red-800',    badge:'badge-critical',bar:'bg-red-500',   dot:'bg-red-500'},
  High:    {color:'text-orange-600 dark:text-orange-400',bg:'bg-orange-50 dark:bg-orange-900/20',border:'border-orange-200 dark:border-orange-800',badge:'badge-high',   bar:'bg-orange-500',dot:'bg-orange-500'},
  Medium:  {color:'text-yellow-600 dark:text-yellow-400',bg:'bg-yellow-50 dark:bg-yellow-900/20',border:'border-yellow-200 dark:border-yellow-800',badge:'badge-medium', bar:'bg-yellow-500',dot:'bg-yellow-500'},
  Low:     {color:'text-green-600 dark:text-green-400',  bg:'bg-green-50 dark:bg-green-900/20',  border:'border-green-200 dark:border-green-800',  badge:'badge-low',    bar:'bg-green-500', dot:'bg-green-500'},
}
export const ROLE_LABELS  = {super_admin:'Super Admin',hod:'HOD',faculty:'Faculty',student:'Student',parent:'Parent'}
export const ROLE_COLORS  = {
  super_admin:'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  hod:        'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  faculty:    'bg-teal-100   text-teal-700   dark:bg-teal-900/30   dark:text-teal-400',
  student:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  parent:     'bg-pink-100   text-pink-700   dark:bg-pink-900/30   dark:text-pink-400',
}
export const DEPARTMENTS = ['CS','IS','EC','EE','ME','CG']
export const DEPT_NAMES  = {CS:'Computer Science',IS:'Information Science',EC:'Electronics & Communication',EE:'Electrical Engineering',ME:'Mechanical Engineering',CG:'CS & Design'}
export const SEMESTERS   = [1,2,3,4,5,6,7,8]
export const SECTIONS    = ['A','B','C','D']
export const SEM_TO_BATCH = {1:25,2:25,3:24,4:24,5:23,6:23,7:22,8:22}

export const fmtPct  = v  => v!=null ? `${Number(v).toFixed(1)}%` : '—'
export const fmtNum  = (v,d=2) => v!=null ? Number(v).toFixed(d) : '—'
export const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'
export const getRiskConfig = level => RISK_CONFIG[level] || RISK_CONFIG.Low
export const classNames = (...c) => c.filter(Boolean).join(' ')
export const debounce  = (fn,ms=300) => { let t; return (...a) => {clearTimeout(t);t=setTimeout(()=>fn(...a),ms)} }
export const CHART_COLORS = ['#3b82f6','#ef4444','#f97316','#eab308','#22c55e','#8b5cf6','#06b6d4']

export const CONDITION_LABELS = {
  low_attendance:      'Low Attendance (< 75%)',
  poor_marks:          'Poor Internal Marks (< 40)',
  consecutive_failure: 'Consecutive Failures / Backlogs',
  performance_drop:    'Performance Drop (CGPA < 5.0)',
  high_risk_score:     'High Risk Score',
  multiple_backlogs:   'Multiple Active Backlogs',
}
export const CONDITION_COLORS = {
  low_attendance:      'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  poor_marks:          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  consecutive_failure: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  performance_drop:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high_risk_score:     'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  multiple_backlogs:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

// Generate USN preview
export function previewUSN(deptCode, semester, serial=1) {
  const yy = SEM_TO_BATCH[semester] || 22
  return `4SN${yy}${deptCode}${String(serial).padStart(3,'0')}`
}
