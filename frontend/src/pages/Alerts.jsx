import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Bell, CheckCheck, RefreshCw, Filter } from 'lucide-react'
import { alertsAPI } from '../utils/api'
import { PageLoader, RiskBadge, EmptyState, Pagination, Select } from '../components/ui/index.jsx'
import { fmtDateTime, classNames } from '../utils/helpers'

const PER_PAGE = 30

export default function AlertsPage() {
  const [data, setData] = useState({ total: 0, alerts: [] })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [acking, setAcking] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        skip: (page - 1) * PER_PAGE, limit: PER_PAGE,
        ...(statusFilter && { status_filter: statusFilter }),
        ...(riskFilter && { risk_level: riskFilter }),
      }
      const { data: d } = await alertsAPI.list(params)
      setData(d)
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }, [page, statusFilter, riskFilter])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => load(), 30000)
    return () => clearInterval(id)
  }, [load])

  const acknowledge = async (id) => {
    setAcking(id)
    try {
      await alertsAPI.acknowledge(id)
      toast.success('Alert acknowledged')
      load()
    } catch { toast.error('Failed to acknowledge') }
    finally { setAcking(null) }
  }

  const statusColor = {
    pending:      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    sent:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    failed:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    acknowledged: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }

  const triggerLabel = { update: 'Data Updated', csv_upload: 'CSV Upload', scheduler: 'Daily Scan', create: 'New Student' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{data.total} total alerts · auto-refreshes every 30s</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'All',            value: '',             count: data.total },
          { label: 'Pending/Sent',   value: 'pending',      count: data.alerts.filter(a => a.status === 'pending').length },
          { label: 'Acknowledged',   value: 'acknowledged', count: data.alerts.filter(a => a.status === 'acknowledged').length },
        ].map(({ label, value, count }) => (
          <button key={value}
            onClick={() => { setStatusFilter(value); setPage(1) }}
            className={classNames(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              statusFilter === value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-surface-dark-secondary border-surface-border dark:border-surface-dark-border text-slate-600 dark:text-slate-400 hover:border-brand-400'
            )}>
            {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
          </button>
        ))}
        <div className="ml-auto">
          <Select value={riskFilter} onChange={v => { setRiskFilter(v); setPage(1) }}
            options={['Critical','High','Medium','Low'].map(r => ({ value: r, label: r }))}
            placeholder="All Risk Levels" className="text-xs py-1.5 h-8" />
        </div>
      </div>

      {/* Alerts list */}
      {loading ? <PageLoader /> : data.alerts.length === 0 ? (
        <EmptyState icon={Bell} title="No alerts" description="Alerts fire automatically when students are flagged as High or Critical risk." />
      ) : (
        <div className="space-y-2.5">
          {data.alerts.map(alert => (
            <div key={alert.id}
              className={classNames('card p-4 flex items-start gap-4 transition-opacity',
                alert.status === 'acknowledged' ? 'opacity-60' : '')}>
              {/* Risk indicator */}
              <div className={classNames('mt-0.5 flex-shrink-0 h-2.5 w-2.5 rounded-full',
                alert.risk_level === 'Critical' ? 'bg-red-500 shadow-lg shadow-red-500/50' :
                alert.risk_level === 'High' ? 'bg-orange-500' : 'bg-yellow-500')} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <RiskBadge level={alert.risk_level} />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {alert.student_name}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{alert.student_code}</span>
                  {alert.department && (
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {alert.department}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500">
                  <span>Risk: <strong className="text-slate-700 dark:text-slate-300">{(alert.risk_probability * 100).toFixed(1)}%</strong></span>
                  <span>Trigger: <strong>{triggerLabel[alert.trigger_reason] || alert.trigger_reason}</strong></span>
                  <span>{fmtDateTime(alert.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={classNames('badge text-xs', statusColor[alert.status])}>{alert.status}</span>
                {alert.status !== 'acknowledged' && (
                  <button onClick={() => acknowledge(alert.id)}
                    disabled={acking === alert.id}
                    className="btn-secondary text-xs gap-1 py-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    {acking === alert.id ? '…' : 'Ack'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} total={data.total} perPage={PER_PAGE} onChange={setPage} />
    </div>
  )
}
