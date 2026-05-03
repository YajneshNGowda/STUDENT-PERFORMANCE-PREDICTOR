import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Bell, CheckCheck, RefreshCw, Filter, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { alertsAPI } from '../utils/api'
import { PageLoader, RiskBadge, EmptyState, Pagination, Select } from '../components/ui/index.jsx'
import { fmtDateTime, classNames } from '../utils/helpers'

const PER_PAGE = 30

const STATUS_CONFIG = {
  pending:      { label:'Pending',      color:'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon:Clock },
  sent:         { label:'Sent',         color:'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',   icon:Bell },
  failed:       { label:'Failed',       color:'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',    icon:XCircle },
  acknowledged: { label:'Acknowledged', color:'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400', icon:CheckCircle },
}

const TRIGGER_LABELS = {
  update:     'Data Updated',
  csv_upload: 'CSV Upload',
  scheduler:  'Daily Scan',
  create:     'New Student',
  batch:      'Batch Import',
}

export default function AlertsPage() {
  const [data,         setData]         = useState({ total:0, alerts:[] })
  const [loading,      setLoading]      = useState(true)
  const [page,         setPage]         = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter,   setRiskFilter]   = useState('')
  const [acking,       setAcking]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data:d } = await alertsAPI.list({
        skip:(page-1)*PER_PAGE, limit:PER_PAGE,
        ...(statusFilter && { status_filter: statusFilter }),
        ...(riskFilter   && { risk_level:    riskFilter }),
      })
      setData(d)
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }, [page, statusFilter, riskFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const acknowledge = async (id) => {
    setAcking(id)
    try {
      await alertsAPI.acknowledge(id)
      toast.success('Alert acknowledged')
      load()
    } catch { toast.error('Failed') }
    finally { setAcking(null) }
  }

  const RISK_LEFT_COLOR = {
    Critical: 'bg-gradient-to-b from-red-500 to-rose-600',
    High:     'bg-gradient-to-b from-orange-400 to-amber-500',
    Medium:   'bg-gradient-to-b from-yellow-400 to-amber-400',
    Low:      'bg-gradient-to-b from-green-400 to-emerald-500',
  }

  const TAB_FILTERS = [
    { label:'All',          value:'',             count: data.total },
    { label:'Unread',       value:'pending',      count: data.alerts.filter(a=>a.status==='pending').length },
    { label:'Sent',         value:'sent',         count: data.alerts.filter(a=>a.status==='sent').length },
    { label:'Acknowledged', value:'acknowledged', count: data.alerts.filter(a=>a.status==='acknowledged').length },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Alert Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data.total} total alerts · Auto-refreshes every 30s
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary gap-2">
          <RefreshCw className={classNames('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Alerts',    value:data.total,                                              color:'from-brand-500 to-violet-500',  icon:Bell },
          { label:'Unacknowledged',  value:data.alerts.filter(a=>['pending','sent'].includes(a.status)).length, color:'from-red-500 to-rose-500',    icon:AlertTriangle },
          { label:'Critical Risk',   value:data.alerts.filter(a=>a.risk_level==='Critical').length,  color:'from-red-600 to-red-500',       icon:AlertTriangle },
          { label:'Acknowledged',    value:data.alerts.filter(a=>a.status==='acknowledged').length,  color:'from-green-500 to-emerald-500', icon:CheckCircle },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
              <s.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-800 dark:text-white">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {TAB_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1) }}
              className={classNames(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                statusFilter === f.value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}>
              {f.label}
              {f.count > 0 && (
                <span className={classNames('ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                  statusFilter===f.value ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400')}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Select value={riskFilter} onChange={v=>{setRiskFilter(v);setPage(1)}}
            options={['Critical','High','Medium','Low'].map(r=>({value:r,label:r}))}
            placeholder="All Risk Levels" className="text-xs h-8 py-1" />
        </div>
      </div>

      {/* Alerts list */}
      {loading ? <PageLoader /> : data.alerts.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Bell} title="No alerts found"
            description="Alerts fire automatically when students are flagged as High or Critical risk. They also trigger on low attendance, poor marks, backlogs, and performance drops." />
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.alerts.map(alert => {
            const sc = STATUS_CONFIG[alert.status] || STATUS_CONFIG.pending
            const StatusIcon = sc.icon
            const isUnread = ['pending','sent'].includes(alert.status)
            return (
              <div key={alert.id}
                className={classNames(
                  'card overflow-hidden flex transition-all duration-200',
                  isUnread ? 'shadow-md' : 'opacity-70 hover:opacity-100'
                )}>
                {/* Left color bar */}
                <div className={classNames('w-1.5 flex-shrink-0', RISK_LEFT_COLOR[alert.risk_level] || 'bg-slate-300')} />

                <div className="flex-1 p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Student info */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <RiskBadge level={alert.risk_level} />
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {alert.student_name || 'Unknown Student'}
                        </span>
                        {alert.student_usn && (
                          <span className="text-xs font-mono text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded-lg">
                            {alert.student_usn}
                          </span>
                        )}
                        {alert.department && (
                          <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {alert.department}
                          </span>
                        )}
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse-soft" />
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {(alert.risk_probability * 100).toFixed(1)}% risk
                        </span>
                        <span>·</span>
                        <span>{TRIGGER_LABELS[alert.trigger_reason] || alert.trigger_reason}</span>
                        <span>·</span>
                        <span>{fmtDateTime(alert.created_at)}</span>
                        {alert.sent_to_faculty_email && (
                          <><span>·</span>
                          <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                            📧 Faculty notified
                          </span></>
                        )}
                        {alert.sent_to_parent_email && (
                          <span className="text-pink-600 dark:text-pink-400 flex items-center gap-0.5">
                            👨‍👩‍👧 Parent notified
                          </span>
                        )}
                      </div>

                      {/* Conditions */}
                      {alert.conditions?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {alert.conditions.map(c => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40">
                              ⚠ {c.replace(/_/g,' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: status + action */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={classNames('badge flex items-center gap-1', sc.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </span>
                      {isUnread && (
                        <button onClick={() => acknowledge(alert.id)}
                          disabled={acking === alert.id}
                          className="btn-secondary text-xs gap-1.5 py-1.5">
                          <CheckCheck className="h-3.5 w-3.5" />
                          {acking === alert.id ? '…' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} total={data.total} perPage={PER_PAGE} onChange={setPage} />
    </div>
  )
}
