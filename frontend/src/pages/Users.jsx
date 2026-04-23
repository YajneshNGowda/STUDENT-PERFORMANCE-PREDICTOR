// ── Users Page ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Users } from 'lucide-react'
import { usersAPI, deptsAPI } from '../utils/api'
import { PageLoader, RoleBadge, Modal, ConfirmDialog, EmptyState, Spinner, Select } from '../components/ui/index.jsx'
import { ROLE_LABELS, fmtDateTime } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

function UserForm({ user, depts, onSave, onClose }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: user || { role: 'faculty' }
  })
  const role = watch('role')
  const onSubmit = async (data) => {
    await onSave({
      ...data,
      department_id: data.department_id ? parseInt(data.department_id) : null,
    })
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Full Name</label>
          <input {...register('full_name', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Username</label>
          <input {...register('username', { required: !user })} className="input" disabled={!!user} />
        </div>
        <div>
          <label className="label">Email</label>
          <input {...register('email', { required: true })} type="email" className="input" disabled={!!user} />
        </div>
        {!user && (
          <div>
            <label className="label">Password</label>
            <input {...register('password', { required: !user, minLength: 8 })} type="password" className="input" />
          </div>
        )}
        <div>
          <label className="label">Role</label>
          <select {...register('role', { required: true })} className="input">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {role !== 'super_admin' && (
          <div>
            <label className="label">Department</label>
            <select {...register('department_id')} className="input">
              <option value="">— Select —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Phone</label>
          <input {...register('phone')} className="input" placeholder="+91 XXXXX XXXXX" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t dark:border-slate-700">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
          {isSubmitting ? <Spinner size="sm" /> : user ? 'Save' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

export function UsersPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([usersAPI.list(), deptsAPI.list()])
      setUsers(uRes.data)
      setDepts(dRes.data)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data) => {
    await usersAPI.create(data)
    toast.success('User created')
    setAddModal(false)
    load()
  }

  const handleEdit = async (data) => {
    await usersAPI.update(editUser.id, data)
    toast.success('User updated')
    setEditUser(null)
    load()
  }

  const handleDelete = async () => {
    await usersAPI.delete(deleteTarget.id)
    toast.success('User deleted')
    setDeleteTarget(null)
    load()
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">User Management</h1>
          <p className="text-sm text-slate-500">{users.length} users</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddModal(true)} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Department</th>
              <th className="th">Last Login</th>
              <th className="th">Status</th>
              {isAdmin && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={7} className="td">
                <EmptyState icon={Users} title="No users found" />
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="tr-hover">
                <td className="td font-medium text-slate-800 dark:text-slate-200">{u.full_name}</td>
                <td className="td text-xs text-slate-600 dark:text-slate-400">{u.email}</td>
                <td className="td"><RoleBadge role={u.role} /></td>
                <td className="td text-sm">{u.department_code || '—'}</td>
                <td className="td text-xs text-slate-500">{fmtDateTime(u.last_login)}</td>
                <td className="td">
                  <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="td">
                    <div className="flex gap-1">
                      <button onClick={() => setEditUser(u)} className="btn-icon p-1.5"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteTarget(u)} className="btn-icon p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Create User">
        <UserForm depts={depts} onSave={handleCreate} onClose={() => setAddModal(false)} />
      </Modal>
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && <UserForm user={editUser} depts={depts} onSave={handleEdit} onClose={() => setEditUser(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} danger title="Delete User"
        message={`Remove ${deleteTarget?.full_name}? This cannot be undone.`} />
    </div>
  )
}

// ── Settings Page ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user } = useAuth()
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm()
  const [saved, setSaved] = useState(false)

  const onPasswordChange = async (data) => {
    try {
      const { authAPI } = await import('../utils/api')
      await authAPI.changePassword(data.current_password, data.new_password)
      toast.success('Password changed successfully')
      setSaved(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Profile Information</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Full Name', user?.full_name],
            ['Email', user?.email],
            ['Username', user?.username],
            ['Role', ROLE_LABELS[user?.role]],
            ['Department', user?.department_code || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</div>
              <div className="text-slate-800 dark:text-slate-200">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Change Password</h2>
        <form onSubmit={handleSubmit(onPasswordChange)} className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input {...register('current_password', { required: true })} type="password" className="input" />
          </div>
          <div>
            <label className="label">New Password</label>
            <input {...register('new_password', { required: true, minLength: { value: 8, message: 'Minimum 8 characters' } })} type="password" className="input" />
            {errors.new_password && <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input {...register('confirm_password', { required: true })} type="password" className="input" />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
