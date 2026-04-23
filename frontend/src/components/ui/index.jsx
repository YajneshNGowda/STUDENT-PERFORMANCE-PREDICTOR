import { classNames, getRiskConfig, ROLE_LABELS, ROLE_COLORS, fmtPct } from '../../utils/helpers'
import { AlertTriangle, CheckCircle, Info, XCircle, X, Loader2 } from 'lucide-react'

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const sz = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size]
  return <Loader2 className={classNames('animate-spin text-brand-600', sz, className)} />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  )
}

// ── Risk Badge ────────────────────────────────────────────────────────────────
export function RiskBadge({ level, probability, showPct = false }) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>
  const cfg = getRiskConfig(level)
  return (
    <span className={cfg.badge}>
      <span className={classNames('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {level}
      {showPct && probability != null && ` · ${fmtPct(probability * 100)}`}
    </span>
  )
}

// ── Role Badge ────────────────────────────────────────────────────────────────
export function RoleBadge({ role }) {
  return (
    <span className={classNames('badge', ROLE_COLORS[role])}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

// ── Risk Progress Bar ─────────────────────────────────────────────────────────
export function RiskBar({ probability, level }) {
  const cfg = getRiskConfig(level)
  const pct = Math.round((probability || 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="risk-bar flex-1" style={{ minWidth: 60 }}>
        <div className={classNames('risk-bar-fill', cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary mb-4">
        {Icon && <Icon className="h-8 w-8 text-slate-400" />}
      </div>
      <h3 className="font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = 'blue', trend }) {
  const colorMap = {
    blue:   { text: 'text-brand-600',   bg: 'bg-brand-50   dark:bg-brand-900/20',   border: 'border-brand-100   dark:border-brand-900/30' },
    red:    { text: 'text-red-600',     bg: 'bg-red-50     dark:bg-red-900/20',     border: 'border-red-100     dark:border-red-900/30' },
    orange: { text: 'text-orange-600',  bg: 'bg-orange-50  dark:bg-orange-900/20',  border: 'border-orange-100  dark:border-orange-900/30' },
    yellow: { text: 'text-yellow-600',  bg: 'bg-yellow-50  dark:bg-yellow-900/20',  border: 'border-yellow-100  dark:border-yellow-900/30' },
    green:  { text: 'text-green-600',   bg: 'bg-green-50   dark:bg-green-900/20',   border: 'border-green-100   dark:border-green-900/30' },
    purple: { text: 'text-purple-600',  bg: 'bg-purple-50  dark:bg-purple-900/20',  border: 'border-purple-100  dark:border-purple-900/30' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={classNames('kpi border', c.border)}>
      <div className="flex items-start justify-between">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className={classNames('p-2 rounded-lg', c.bg)}>
            <Icon className={classNames('h-4 w-4', c.text)} />
          </div>
        )}
      </div>
      <div className={classNames('kpi-value', c.text)}>{value ?? '—'}</div>
      {(sub || trend) && (
        <div className="kpi-sub flex items-center gap-1">
          {trend && <span className={trend > 0 ? 'text-red-500' : 'text-green-500'}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={classNames('relative card w-full animate-in', sizes[size])}>
        <div className="flex items-center justify-between p-5 border-b border-surface-border dark:border-surface-dark-border">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { onConfirm(); onClose() }} className={danger ? 'btn-danger' : 'btn-primary'}>
          Confirm
        </button>
      </div>
    </Modal>
  )
}

// ── Table pagination ──────────────────────────────────────────────────────────
export function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border dark:border-surface-dark-border">
      <span className="text-xs text-slate-500">
        Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1} className="btn-ghost py-1 px-2 text-xs">← Prev</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
          return p <= totalPages ? (
            <button key={p} onClick={() => onChange(p)}
              className={classNames('px-3 py-1 rounded text-xs font-medium transition-colors',
                p === page ? 'bg-brand-600 text-white' : 'btn-ghost')}>
              {p}
            </button>
          ) : null
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="btn-ghost py-1 px-2 text-xs">Next →</button>
      </div>
    </div>
  )
}

// ── Search Input ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={classNames('relative', className)}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9" />
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, placeholder, className = '' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={classNames('input', className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  )
}

// ── Toast-style inline alert ──────────────────────────────────────────────────
export function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info:    { bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200',  text: 'text-blue-800 dark:text-blue-300',  Icon: Info },
    success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200', text: 'text-green-800 dark:text-green-300',Icon: CheckCircle },
    warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20',border:'border-yellow-200',text: 'text-yellow-800 dark:text-yellow-300',Icon: AlertTriangle },
    error:   { bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200',   text: 'text-red-800 dark:text-red-300',    Icon: XCircle },
  }
  const s = styles[type]
  return (
    <div className={classNames('flex items-start gap-3 p-4 rounded-lg border', s.bg, s.border)}>
      <s.Icon className={classNames('h-4 w-4 mt-0.5 flex-shrink-0', s.text)} />
      <p className={classNames('text-sm flex-1', s.text)}>{message}</p>
      {onClose && <button onClick={onClose} className={classNames('ml-auto', s.text)}><X className="h-4 w-4" /></button>}
    </div>
  )
}

// ── SHAP Factor Row ───────────────────────────────────────────────────────────
export function ShapFactor({ feature, shap_value, impact, value }) {
  const isRisk = impact === 'increases'
  const absVal = Math.abs(shap_value)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-border/50 dark:border-surface-dark-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          <span className={classNames('text-xs font-semibold ml-2 flex-shrink-0', isRisk ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
            {isRisk ? '▲' : '▼'} {(absVal * 100).toFixed(1)}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className={classNames('h-full rounded-full transition-all', isRisk ? 'bg-red-500' : 'bg-green-500')}
            style={{ width: `${Math.min(absVal * 40, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
