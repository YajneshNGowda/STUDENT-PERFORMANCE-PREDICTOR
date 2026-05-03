// ── Users Page + Settings Page ───────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit2, Users, Shield, UserCheck,
  GraduationCap, Crown, Key, Phone, Mail, Building2,
  Eye, EyeOff, Save, Lock
} from 'lucide-react'
import { usersAPI, deptsAPI } from '../utils/api'
import {
  PageLoader, RoleBadge, Modal, ConfirmDialog,
  EmptyState, Spinner
} from '../components/ui/index.jsx'
import { ROLE_LABELS, fmtDateTime, classNames } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

const ROLE_CONFIG = {
  super_admin: { icon: Crown,       gradient:'from-purple-500 to-violet-600', label:'Super Admin' },
  hod:         { icon: Shield,      gradient:'from-blue-500   to-cyan-600',   label:'HOD' },
  faculty:     { icon: UserCheck,   gradient:'from-teal-500   to-emerald-600',label:'Faculty' },
  student:     { icon: GraduationCap,gradient:'from-indigo-500 to-blue-600',  label:'Student' },
  parent:      { icon: Users,       gradient:'from-pink-500   to-rose-600',   label:'Parent' },
}

function UserForm({ user, depts, onSave, onClose }) {
  const { register, handleSubmit, watch, formState:{ errors, isSubmitting } } = useForm({
    defaultValues: user || { role:'faculty' }
  })
  const role     = watch('role')
  const onSubmit = async (data) => {
    await onSave({ ...data, department_id: data.department_id ? parseInt(data.department_id) : null })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name</label>
          <input {...register('full_name',{required:'Required'})} className="input" placeholder="Dr. John Smith" />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">⚠ {errors.full_name.message}</p>}
        </div>
        <div>
          <label className="label">Username</label>
          <input {...register('username',{required:!user})} className="input font-mono"
            placeholder="john_smith" disabled={!!user} />
        </div>
        <div>
          <label className="label">Email Address</label>
          <input {...register('email',{required:'Required'})} type="email"
            className="input" placeholder="john@college.edu" disabled={!!user} />
          {errors.email && <p className="text-xs text-red-500 mt-1">⚠ {errors.email.message}</p>}
        </div>
        {!user && (
          <div>
            <label className="label">Password</label>
            <input {...register('password',{required:!user, minLength:{value:8,message:'Min 8 chars'}})}
              type="password" className="input" placeholder="Min. 8 characters" />
            {errors.password && <p className="text-xs text-red-500 mt-1">⚠ {errors.password.message}</p>}
          </div>
        )}
        <div>
          <label className="label">Role</label>
          <select {...register('role',{required:true})} className="input">
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'student' && k !== 'parent').map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {role !== 'super_admin' && (
          <div>
            <label className="label">Department</label>
            <select {...register('department_id')} className="input">
              <option value="">— Select Department —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Phone Number</label>
          <input {...register('phone')} className="input" placeholder="+91 98765 43210" />
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
          {isSubmitting ? <Spinner size="sm" /> : user ? '💾 Save Changes' : '✨ Create User'}
        </button>
      </div>
    </form>
  )
}

export function UsersPage() {
  const { isAdmin } = useAuth()
  const [users,        setUsers]       = useState([])
  const [depts,        setDepts]       = useState([])
  const [loading,      setLoading]     = useState(true)
  const [addModal,     setAddModal]    = useState(false)
  const [editUser,     setEditUser]    = useState(null)
  const [deleteTarget, setDeleteTarget]= useState(null)
  const [roleFilter,   setRoleFilter]  = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([usersAPI.list(), deptsAPI.list()])
      setUsers(uRes.data); setDepts(dRes.data)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data) => { await usersAPI.create(data);    toast.success('User created!');  setAddModal(false); load() }
  const handleEdit   = async (data) => { await usersAPI.update(editUser.id,data); toast.success('Updated!'); setEditUser(null); load() }
  const handleDelete = async ()     => { await usersAPI.delete(deleteTarget.id);  toast.success('Deleted'); setDeleteTarget(null); load() }

  const filtered = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter)

  // Role stats
  const roleStats = Object.entries(ROLE_LABELS).map(([role, label]) => ({
    role, label,
    count: users.filter(u => u.role === role).length,
    ...ROLE_CONFIG[role],
  })).filter(r => r.count > 0 || ['super_admin','hod','faculty'].includes(r.role))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">User Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} total users across all roles</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddModal(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {roleStats.filter(r => ['super_admin','hod','faculty'].includes(r.role)).map(r => (
          <button key={r.role}
            onClick={() => setRoleFilter(roleFilter === r.role ? 'all' : r.role)}
            className={classNames(
              'card p-4 text-left transition-all duration-200 group',
              roleFilter === r.role ? 'ring-2 ring-brand-500 shadow-md' : 'hover:shadow-md hover:-translate-y-0.5'
            )}>
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
              <r.icon className="h-4.5 w-4.5 text-white" style={{height:'18px',width:'18px'}} />
            </div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{r.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{r.label}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{value:'all',label:'All Users'},...Object.entries(ROLE_LABELS).filter(([k]) => !['student','parent'].includes(k)).map(([v,l]) => ({value:v,label:l}))].map(f => (
          <button key={f.value}
            onClick={() => setRoleFilter(f.value)}
            className={classNames(
              'px-4 py-1.5 rounded-xl text-xs font-bold transition-all',
              roleFilter === f.value
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600'
            )}>
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 opacity-70">({users.filter(u => u.role===f.value).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Users grid */}
      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Users} title="No users found" description="Add a new user to get started." />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => {
            const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.faculty
            const RoleIcon = rc.icon
            return (
              <div key={u.id} className="card-hover group p-5 relative overflow-hidden">
                {/* Subtle gradient bg */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${rc.gradient} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2`} />

                <div className="relative">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${rc.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                        <span className="text-white font-black text-sm">
                          {u.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{u.full_name}</div>
                        <RoleBadge role={u.role} />
                      </div>
                    </div>
                    {/* Active dot */}
                    <div className={classNames('h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0',
                      u.is_active ? 'bg-green-500' : 'bg-slate-300')}>
                      {u.is_active && <div className="h-full w-full rounded-full bg-green-500 animate-ping opacity-40" />}
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.department_code && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <span>{u.department_code} — {u.department_name}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Key className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Last login: {u.last_login ? fmtDateTime(u.last_login) : 'Never'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && u.role !== 'super_admin' && (
                    <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setEditUser(u)}
                        className="btn-secondary flex-1 text-xs py-1.5 gap-1.5">
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => setDeleteTarget(u)}
                        className="btn-ghost text-xs py-1.5 px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <Modal open={addModal}    onClose={() => setAddModal(false)} title="✨ Create New User" size="md">
        <UserForm depts={depts} onSave={handleCreate} onClose={() => setAddModal(false)} />
      </Modal>
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="✏️ Edit User" size="md">
        {editUser && <UserForm user={editUser} depts={depts} onSave={handleEdit} onClose={() => setEditUser(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} danger
        title="Delete User"
        message={`Remove ${deleteTarget?.full_name}? They will lose all access immediately.`} />
    </div>
  )
}

// ── Settings Page ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user } = useAuth()
  const [showCurr, setShowCurr] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const { register, handleSubmit, reset, formState:{ errors, isSubmitting } } = useForm()

  const onPasswordChange = async (data) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Passwords do not match'); return
    }
    try {
      const { authAPI } = await import('../utils/api')
      await authAPI.changePassword(data.current_password, data.new_password)
      toast.success('Password changed successfully')
      reset()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password') }
  }

  const profileFields = [
    { label:'Full Name',   value:user?.full_name,                        icon:Users },
    { label:'Email',       value:user?.email,                            icon:Mail },
    { label:'Username',    value:user?.username,                         icon:Key },
    { label:'Role',        value:ROLE_LABELS[user?.role],                icon:Shield },
    { label:'Department',  value:user?.department_code || '—',           icon:Building2 },
    { label:'Last Login',  value:user?.last_login ? fmtDateTime(user.last_login) : 'N/A', icon:UserCheck },
  ]

  return (
    <div className="space-y-6 max-w-2xl">

      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Account Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your profile and security preferences</p>
      </div>

      {/* Profile card */}
      <div className="card overflow-hidden">
        {/* Profile header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800"
          style={{background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.04))'}}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black text-white"
              style={{background:'linear-gradient(135deg,#4f46e5,#a855f7)'}}>
              {user?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">{user?.full_name}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </div>

        {/* Profile fields */}
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3">
            {profileFields.map(({ label, value, icon:Icon }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{label}</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Change Password</h3>
            <p className="text-xs text-slate-500">Use a strong password with uppercase, numbers and symbols</p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit(onPasswordChange)} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input {...register('current_password',{required:'Required'})}
                  type={showCurr ? 'text' : 'password'}
                  className="input pl-10 pr-10" placeholder="Enter current password" />
                <button type="button" onClick={() => setShowCurr(s=>!s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurr ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.current_password && <p className="text-xs text-red-500 mt-1">⚠ {errors.current_password.message}</p>}
            </div>

            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input {...register('new_password',{required:'Required',minLength:{value:8,message:'Min 8 characters'}})}
                  type={showNew ? 'text' : 'password'}
                  className="input pl-10 pr-10" placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowNew(s=>!s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.new_password && <p className="text-xs text-red-500 mt-1">⚠ {errors.new_password.message}</p>}
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input {...register('confirm_password',{required:'Required'})}
                  type="password" className="input pl-10" placeholder="Repeat new password" />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary gap-2 w-full justify-center">
              {isSubmitting ? <Spinner size="sm" /> : <><Save className="h-4 w-4" /> Update Password</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
