import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ShieldCheck, GraduationCap, Users, Eye, EyeOff, Mail, Lock, User, Hash, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/index.jsx'

const PORTALS = [
  { id:'staff',   label:'Staff Login',   icon:ShieldCheck,    color:'blue',   desc:'Admin · HOD · Faculty' },
  { id:'student', label:'Student Login', icon:GraduationCap,  color:'indigo', desc:'View your academic profile' },
  { id:'parent',  label:'Parent Login',  icon:Users,          color:'pink',   desc:"View your ward's progress" },
]

export default function LoginPage() {
  const { login, studentLogin, parentLogin } = useAuth()
  const navigate = useNavigate()
  const [portal, setPortal] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('portals') // portals | form | forgot | sent

  const { register, handleSubmit, reset, formState:{errors} } = useForm()
  const forgotForm = useForm()

  const colorMap = {
    blue:  { btn:'bg-brand-600 hover:bg-brand-700 shadow-brand-500/30', border:'border-brand-200 dark:border-brand-800', bg:'bg-brand-50 dark:bg-brand-900/20', icon:'text-brand-600 dark:text-brand-400', ring:'focus:ring-brand-500' },
    indigo:{ btn:'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30', border:'border-indigo-200 dark:border-indigo-800', bg:'bg-indigo-50 dark:bg-indigo-900/20', icon:'text-indigo-600 dark:text-indigo-400', ring:'focus:ring-indigo-500' },
    pink:  { btn:'bg-pink-600 hover:bg-pink-700 shadow-pink-500/30', border:'border-pink-200 dark:border-pink-800', bg:'bg-pink-50 dark:bg-pink-900/20', icon:'text-pink-600 dark:text-pink-400', ring:'focus:ring-pink-500' },
  }
  const c = portal ? colorMap[portal.color] : colorMap.blue

  const handlePortalSelect = (p) => { setPortal(p); setView('form'); reset() }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      if (portal.id === 'staff') {
        await login(data.email, data.password)
      } else if (portal.id === 'student') {
        await studentLogin(data.full_name, data.usn)
      } else {
        await parentLogin(data.full_name, data.usn)
      }
      toast.success('Welcome to EduGuard!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  const onForgot = async (data) => {
    setLoading(true)
    try {
      const { authAPI } = await import('../utils/api')
      await authAPI.forgotPassword(data.email)
      setView('sent')
    } catch { toast.error('Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-100/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-500/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-600 shadow-xl shadow-brand-500/30 mb-4">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">EduGuard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Student Risk Intelligence Platform</p>
        </div>

        {/* Portal Selection */}
        {view === 'portals' && (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-5">Choose your login type to continue</p>
            {PORTALS.map(p => {
              const cm = colorMap[p.color]
              return (
                <button key={p.id} onClick={() => handlePortalSelect(p)}
                  className={`w-full card p-5 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-2 hover:${cm.border} group`}>
                  <div className={`p-3 rounded-xl ${cm.bg}`}>
                    <p.icon className={`h-6 w-6 ${cm.icon}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{p.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{p.desc}</div>
                  </div>
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cm.bg} ${cm.icon}`}>→</div>
                </button>
              )
            })}
            <p className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              Contact your administrator for login credentials
            </p>
          </div>
        )}

        {/* Login Form */}
        {view === 'form' && portal && (
          <div className="card p-8">
            <button onClick={() => { setView('portals'); setPortal(null) }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2.5 rounded-xl ${c.bg}`}>
                <portal.icon className={`h-5 w-5 ${c.icon}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{portal.label}</h2>
                <p className="text-xs text-slate-500">{portal.desc}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {portal.id === 'staff' ? (
                <>
                  <div>
                    <label className="label">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input {...register('email',{required:'Required'})} type="email"
                        placeholder="your@college.edu" className="input pl-9" autoComplete="email" />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input {...register('password',{required:'Required'})}
                        type={showPass?'text':'password'} placeholder="••••••••"
                        className="input pl-9 pr-10" autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPass(s=>!s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setView('forgot')}
                      className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400">
                      Forgot password?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`p-3 rounded-lg ${c.bg} border ${c.border}`}>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {portal.id === 'student' ? 'Login with your name and USN' : "Login with your ward's name and USN"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Example USN: <span className="font-mono">4SN22CS001</span></p>
                  </div>
                  <div>
                    <label className="label">{portal.id === 'student' ? 'Your Full Name' : "Student's Full Name"}</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input {...register('full_name',{required:'Required'})}
                        placeholder="As per college records" className="input pl-9" />
                    </div>
                    {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
                  </div>
                  <div>
                    <label className="label">USN (University Seat Number)</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input {...register('usn',{required:'Required',pattern:{value:/^4SN\d{2}[A-Z]{2}\d{3}$/i,message:'Format: 4SN22CS001'}})}
                        placeholder="4SN22CS001" className="input pl-9 font-mono uppercase"
                        onChange={e => { const el = e.target; el.value = el.value.toUpperCase() }} />
                    </div>
                    {errors.usn && <p className="text-xs text-red-500 mt-1">{errors.usn.message}</p>}
                  </div>
                </>
              )}

              <button type="submit" disabled={loading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-all shadow-lg ${c.btn} disabled:opacity-50`}>
                {loading ? <Spinner size="sm" /> : `Sign In as ${portal.label.split(' ')[0]}`}
              </button>
            </form>
          </div>
        )}

        {/* Forgot password */}
        {view === 'forgot' && (
          <div className="card p-8">
            <button onClick={() => setView('form')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Reset Password</h2>
            <p className="text-sm text-slate-500 mb-5">Enter your staff email to receive a reset link.</p>
            <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input {...forgotForm.register('email',{required:true})} type="email" className="input" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Spinner size="sm" /> : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}

        {/* Sent */}
        {view === 'sent' && (
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <Mail className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Check Your Email</h2>
            <p className="text-sm text-slate-500 mb-6">A reset link has been sent if that email is registered.</p>
            <button onClick={() => { setView('portals'); setPortal(null) }} className="btn-secondary w-full justify-center">
              Back to Login
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} EduGuard · Early Warning System</p>
      </div>
    </div>
  )
}
