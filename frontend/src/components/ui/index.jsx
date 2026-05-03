import { classNames, getRiskConfig, ROLE_LABELS, ROLE_COLORS, fmtPct } from '../../utils/helpers'
import { AlertTriangle, CheckCircle, Info, XCircle, X, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 'md', className = '' }) {
  const sz = { sm:'h-4 w-4', md:'h-6 w-6', lg:'h-10 w-10' }[size]
  return <Loader2 className={classNames('animate-spin text-brand-600', sz, className)} />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
            <span className="text-xl">🛡</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-brand opacity-20 blur animate-pulse-soft" />
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-brand-500"
              style={{animation:`bounceDot 1.4s ease-in-out ${i*0.16}s infinite`}} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Risk Badge ──────────────────────────────────────────────────────────── */
export function RiskBadge({ level, probability, showPct = false }) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>
  const cfg = getRiskConfig(level)
  const icons = { Critical:'🔴', High:'🟠', Medium:'🟡', Low:'🟢' }
  return (
    <span className={cfg.badge}>
      <span className="text-xs">{icons[level]}</span>
      {level}
      {showPct && probability != null && <span className="opacity-70">· {fmtPct(probability * 100)}</span>}
    </span>
  )
}

/* ── Role Badge ──────────────────────────────────────────────────────────── */
export function RoleBadge({ role }) {
  return (
    <span className={classNames('badge', ROLE_COLORS[role])}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

/* ── Risk Progress Bar ───────────────────────────────────────────────────── */
export function RiskBar({ probability, level }) {
  const cfg = getRiskConfig(level)
  const pct = Math.round((probability || 0) * 100)
  const gradMap = {
    Critical: 'linear-gradient(90deg,#ef4444,#f43f5e)',
    High:     'linear-gradient(90deg,#f97316,#fb923c)',
    Medium:   'linear-gradient(90deg,#eab308,#facc15)',
    Low:      'linear-gradient(90deg,#22c55e,#4ade80)',
  }
  return (
    <div className="flex items-center gap-2">
      <div className="risk-bar flex-1" style={{minWidth:60}}>
        <div className="risk-bar-fill" style={{width:`${pct}%`, background: gradMap[level]||'#94a3b8'}} />
      </div>
      <span className="text-xs font-mono font-semibold text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  )
}

/* ── Empty State ─────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-5">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto shadow-inner">
          {Icon && <Icon className="h-7 w-7 text-slate-400 dark:text-slate-500" />}
        </div>
      </div>
      <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, color = 'blue', trend }) {
  const cfg = {
    blue:   { gradient:'from-brand-500 to-brand-600',   iconBg:'bg-brand-50   dark:bg-brand-900/30',   iconColor:'text-brand-600   dark:text-brand-400',  valColor:'text-brand-700   dark:text-brand-300',  border:'border-brand-100   dark:border-brand-900/40',  glow:'shadow-glow-brand/20' },
    red:    { gradient:'from-red-500    to-rose-500',    iconBg:'bg-red-50     dark:bg-red-900/30',     iconColor:'text-red-600     dark:text-red-400',     valColor:'text-red-700     dark:text-red-300',     border:'border-red-100     dark:border-red-900/40',    glow:'' },
    orange: { gradient:'from-orange-500 to-amber-500',  iconBg:'bg-orange-50  dark:bg-orange-900/30',  iconColor:'text-orange-600  dark:text-orange-400',  valColor:'text-orange-700  dark:text-orange-300',  border:'border-orange-100  dark:border-orange-900/40', glow:'' },
    yellow: { gradient:'from-yellow-400 to-amber-500',  iconBg:'bg-yellow-50  dark:bg-yellow-900/30',  iconColor:'text-yellow-600  dark:text-yellow-400',  valColor:'text-yellow-700  dark:text-yellow-300',  border:'border-yellow-100  dark:border-yellow-900/40', glow:'' },
    green:  { gradient:'from-emerald-400 to-teal-500',  iconBg:'bg-green-50   dark:bg-green-900/30',   iconColor:'text-green-600   dark:text-green-400',   valColor:'text-green-700   dark:text-green-300',   border:'border-green-100   dark:border-green-900/40',  glow:'shadow-glow-green/20' },
    purple: { gradient:'from-purple-500  to-violet-600',iconBg:'bg-purple-50  dark:bg-purple-900/30',  iconColor:'text-purple-600  dark:text-purple-400',  valColor:'text-purple-700  dark:text-purple-300',  border:'border-purple-100  dark:border-purple-900/40', glow:'' },
  }
  const c = cfg[color] || cfg.blue
  return (
    <div className={classNames('kpi border', c.border, 'group hover:shadow-card-hover transition-all duration-200')}>
      <div className="flex items-start justify-between mb-2">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className={classNames('p-2.5 rounded-xl transition-transform group-hover:scale-110', c.iconBg)}>
            <Icon className={classNames('h-4 w-4', c.iconColor)} />
          </div>
        )}
      </div>
      <div className={classNames('kpi-value', c.valColor)}>{value ?? '—'}</div>
      {(sub || trend != null) && (
        <div className="kpi-sub flex items-center gap-1.5 mt-1">
          {trend != null && (
            trend > 0
              ? <span className="trend-up flex items-center gap-0.5"><TrendingUp className="h-3 w-3"/>↑{Math.abs(trend)}%</span>
              : <span className="trend-down flex items-center gap-0.5"><TrendingDown className="h-3 w-3"/>↓{Math.abs(trend)}%</span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={classNames('relative w-full animate-in', sizes[size])}>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-dark-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{title}</h2>
            <button onClick={onClose} className="btn-icon h-8 w-8 rounded-lg">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ── Confirm Dialog ──────────────────────────────────────────────────────── */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { onConfirm(); onClose() }} className={danger ? 'btn-danger' : 'btn-primary'}>
          {danger ? '🗑 Delete' : 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Pagination ──────────────────────────────────────────────────────────── */
export function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-slate-900/50">
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        {(page-1)*perPage+1}–{Math.min(page*perPage, total)} of <strong>{total}</strong>
      </span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page-1)} disabled={page===1}
          className="btn-ghost py-1.5 px-3 text-xs rounded-lg disabled:opacity-40">← Prev</button>
        {Array.from({length:Math.min(5,totalPages)}, (_,i) => {
          const p = Math.max(1,Math.min(page-2,totalPages-4))+i
          return p<=totalPages ? (
            <button key={p} onClick={() => onChange(p)}
              className={classNames('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                p===page
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
              {p}
            </button>
          ) : null
        })}
        <button onClick={() => onChange(page+1)} disabled={page===totalPages}
          className="btn-ghost py-1.5 px-3 text-xs rounded-lg disabled:opacity-40">Next →</button>
      </div>
    </div>
  )
}

/* ── Search Input ────────────────────────────────────────────────────────── */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={classNames('relative', className)}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input pl-9" />
    </div>
  )
}

/* ── Select ──────────────────────────────────────────────────────────────── */
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

/* ── Alert Banner ────────────────────────────────────────────────────────── */
export function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info:    { bg:'bg-blue-50   dark:bg-blue-900/20',   border:'border-blue-200   dark:border-blue-800',   text:'text-blue-800   dark:text-blue-300',   Icon:Info },
    success: { bg:'bg-green-50  dark:bg-green-900/20',  border:'border-green-200  dark:border-green-800',  text:'text-green-800  dark:text-green-300',  Icon:CheckCircle },
    warning: { bg:'bg-yellow-50 dark:bg-yellow-900/20', border:'border-yellow-200 dark:border-yellow-800', text:'text-yellow-800 dark:text-yellow-300', Icon:AlertTriangle },
    error:   { bg:'bg-red-50    dark:bg-red-900/20',    border:'border-red-200    dark:border-red-800',    text:'text-red-800    dark:text-red-300',    Icon:XCircle },
  }
  const s = styles[type]
  return (
    <div className={classNames('flex items-start gap-3 p-4 rounded-xl border', s.bg, s.border)}>
      <s.Icon className={classNames('h-4 w-4 mt-0.5 flex-shrink-0', s.text)} />
      <p className={classNames('text-sm flex-1 leading-relaxed', s.text)}>{message}</p>
      {onClose && (
        <button onClick={onClose} className={classNames('ml-auto flex-shrink-0', s.text)}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ── SHAP Factor Row ─────────────────────────────────────────────────────── */
export function ShapFactor({ feature, shap_value, impact, value }) {
  const isRisk = impact === 'increases'
  const absVal = Math.abs(shap_value)
  const pct    = Math.min(absVal * 40, 100)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
            {feature.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {value !== undefined && (
              <span className="text-xs font-mono text-slate-400">{value}</span>
            )}
            <span className={classNames('text-xs font-bold px-1.5 py-0.5 rounded-md',
              isRisk
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400')}>
              {isRisk ? '▲' : '▼'} {(absVal*100).toFixed(1)}
            </span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={classNames('h-full rounded-full transition-all duration-700',
            isRisk
              ? 'bg-gradient-to-r from-red-400 to-rose-500'
              : 'bg-gradient-to-r from-green-400 to-emerald-500')}
            style={{width:`${pct}%`}} />
        </div>
      </div>
    </div>
  )
}
