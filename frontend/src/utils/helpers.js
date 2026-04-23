export const RISK_CONFIG = {
  Critical: { color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-200 dark:border-red-800',    badge: 'badge-critical', bar: 'bg-red-500',    dot: 'bg-red-500' },
  High:     { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', badge: 'badge-high',     bar: 'bg-orange-500', dot: 'bg-orange-500' },
  Medium:   { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', badge: 'badge-medium',   bar: 'bg-yellow-500', dot: 'bg-yellow-500' },
  Low:      { color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   badge: 'badge-low',      bar: 'bg-green-500',  dot: 'bg-green-500' },
}

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  hod: 'HOD',
  faculty: 'Faculty',
}

export const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  hod:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  faculty:     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
}

export const DEPARTMENTS = ['CSE','ISE','AIML','ECE','EEE','MECH','CIVIL']
export const SEMESTERS   = [1,2,3,4,5,6,7,8]
export const SECTIONS    = ['A','B','C','D']

export function fmtPct(v) { return v != null ? `${Number(v).toFixed(1)}%` : '—' }
export function fmtNum(v, d=2) { return v != null ? Number(v).toFixed(d) : '—' }
export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}
export function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
}

export function getRiskConfig(level) {
  return RISK_CONFIG[level] || RISK_CONFIG.Low
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function debounce(fn, ms=300) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

export const CHART_COLORS = ['#3b82f6','#ef4444','#f97316','#eab308','#22c55e','#8b5cf6','#06b6d4']
