import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ShieldCheck, GraduationCap, Users, Eye, EyeOff,
         Mail, Lock, User, Hash, ArrowLeft, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/index.jsx'

const PORTALS = [
  {
    id:'staff',
    label:'Staff Portal',
    icon:ShieldCheck,
    gradient:'from-brand-600 to-violet-600',
    lightBg:'from-indigo-50 to-violet-50',
    border:'border-indigo-200 dark:border-indigo-800',
    desc:'Admin · HOD · Faculty access',
    fields:'email',
    badge:'🏫',
  },
  {
    id:'student',
    label:'Student Portal',
    icon:GraduationCap,
    gradient:'from-emerald-500 to-teal-600',
    lightBg:'from-emerald-50 to-teal-50',
    border:'border-emerald-200 dark:border-emerald-800',
    desc:'View your academic performance',
    fields:'usn',
    badge:'🎓',
  },
  {
    id:'parent',
    label:'Parent Portal',
    icon:Users,
    gradient:'from-pink-500 to-rose-500',
    lightBg:'from-pink-50 to-rose-50',
    border:'border-pink-200 dark:border-pink-800',
    desc:"Monitor your ward's progress",
    fields:'usn',
    badge:'👨‍👩‍👧',
  },
]

export default function LoginPage() {
  const { login, studentLogin, parentLogin } = useAuth()
  const navigate  = useNavigate()
  const [portal,   setPortal]   = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [view,     setView]     = useState('portals')

  const { register, handleSubmit, reset, formState:{ errors } } = useForm()
  const forgotForm = useForm()

  const selectPortal = (p) => { setPortal(p); setView('form'); reset() }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      if      (portal.id === 'staff')   await login(data.email, data.password)
      else if (portal.id === 'student') await studentLogin(data.full_name, data.usn)
      else                              await parentLogin(data.full_name, data.usn)
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
    <div className="min-h-screen flex overflow-hidden" style={{background:'linear-gradient(135deg,#0f0c29 0%,#1e1b4b 40%,#312e81 70%,#4f46e5 100%)'}}>

      {/* ── Left decorative panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] relative overflow-hidden"
        style={{background:'linear-gradient(135deg,#312e81 0%,#4f46e5 40%,#7c3aed 70%,#a855f7 100%)'}}>

        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20"
            style={{background:'radial-gradient(circle,#c4b5fd,transparent 70%)'}} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15"
            style={{background:'radial-gradient(circle,#60a5fa,transparent 70%)'}} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
            style={{background:'radial-gradient(circle,#f9a8d4,transparent 70%)'}} />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Top logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-white font-extrabold text-xl tracking-tight">EduGuard</div>
              <div className="text-white/60 text-xs">Risk Intelligence Platform</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-10 py-8">

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Protect Every<br />
            <span style={{background:'linear-gradient(90deg,#fbbf24,#f9a8d4)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Student's Future
            </span>
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-8">
            Proactively identify at-risk students using machine learning before failures happen.
          </p>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {num:'200+', label:'Students Monitored'},
              {num:'18%',  label:'At-Risk Detected'},
              {num:'99%',  label:'Model Accuracy'},
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15 text-center">
                <div className="text-2xl font-black text-white">{s.num}</div>
                <div className="text-white/60 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 p-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {['bg-emerald-400','bg-blue-400','bg-purple-400','bg-pink-400'].map((c,i) => (
              <div key={i} className={`h-7 w-7 rounded-full border-2 border-white/30 ${c} flex items-center justify-center text-xs font-bold text-white`}>
                {String.fromCharCode(65+i)}
              </div>
            ))}
          </div>
          <div className="text-white/60 text-xs">
            Trusted by 200+ students across 6 departments
          </div>
        </div>
      </div>

      {/* ── Right: Login panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto" style={{background:'rgba(255,255,255,0.06)',backdropFilter:'blur(20px)'}}>
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-3 shadow-lg"
              style={{background:'linear-gradient(135deg,#4f46e5,#a855f7)'}}>
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">EduGuard</h1>
            <p className="text-white/60 text-sm mt-1">Student Risk Intelligence Platform</p>
          </div>

          {/* ── Portal selection ── */}
          {view === 'portals' && (
            <div className="text-white">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white mb-1">Welcome back</h2>
                <p className="text-white/60 text-sm">Choose your portal to continue</p>
              </div>

              <div className="space-y-3">
                {PORTALS.map(p => (
                  <button key={p.id} onClick={() => selectPortal(p)}
                    className="w-full group relative overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-sm p-5 text-left transition-all duration-200 hover:border-white/40 hover:bg-white/15 hover:shadow-xl"
                    style={{'--hover-shadow':'0 8px 30px rgba(99,102,241,0.15)'}}>

                    {/* Hover gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${p.lightBg} opacity-0 group-hover:opacity-100 transition-opacity`} />

                    <div className="relative flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <p.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{p.label}</span>
                          <span className="text-base">{p.badge}</span>
                        </div>
                        <div className="text-sm text-white/60 mt-0.5">{p.desc}</div>
                      </div>
                      <div className="text-white/40 group-hover:text-white transition-colors text-xl">→</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4">
                Contact your college administrator for login credentials
              </div>
            </div>
          )}

          {/* ── Login form ── */}
          {view === 'form' && portal && (
            <div>
              <button onClick={() => { setView('portals'); setPortal(null) }}
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition-colors group">
                <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </div>
                Back to portals
              </button>

              {/* Form header */}
              <div className="mb-6">
                <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-br ${portal.lightBg} border ${portal.border} mb-4`}>
                  <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${portal.gradient} flex items-center justify-center`}>
                    <portal.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{portal.label}</div>
                    <div className="text-xs text-slate-500">{portal.desc}</div>
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white">Sign in</h2>
                <p className="text-white/60 text-sm mt-1">
                  {portal.id === 'staff'
                    ? 'Enter your staff credentials'
                    : portal.id === 'student'
                    ? 'Enter your name and USN to continue'
                    : "Enter your ward's name and USN"}
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                {portal.id === 'staff' ? (
                  <>
                    <div>
                      <label className="label">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input {...register('email',{required:'Email is required'})}
                          type="email" placeholder="you@college.edu"
                          className="input pl-10" autoComplete="email" />
                      </div>
                      {errors.email && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">⚠ {errors.email.message}</p>}
                    </div>

                    <div>
                      <label className="label">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input {...register('password',{required:'Password is required'})}
                          type={showPass?'text':'password'} placeholder="••••••••"
                          className="input pl-10 pr-11" autoComplete="current-password" />
                        <button type="button" onClick={() => setShowPass(s=>!s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5">
                          {showPass ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">⚠ {errors.password.message}</p>}
                    </div>

                    <div className="flex justify-end">
                      <button type="button" onClick={() => setView('forgot')}
                        className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">
                        Forgot password?
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        {portal.id==='student' ? '🎓 Student Login' : '👨‍👩‍👧 Parent Login'}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                        {portal.id==='student'
                          ? 'Use the full name registered at admission and your USN as credentials.'
                          : "Use your ward's full name and their USN to log in."}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        USN format: <span className="font-mono font-bold">4SN22CS001</span>
                      </p>
                    </div>

                    <div>
                      <label className="label">
                        {portal.id==='student' ? 'Your Full Name' : "Student's Full Name"}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input {...register('full_name',{required:'Full name is required'})}
                          placeholder="As per college records"
                          className="input pl-10" />
                      </div>
                      {errors.full_name && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.full_name.message}</p>}
                    </div>

                    <div>
                      <label className="label">USN (University Seat Number)</label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          {...register('usn',{
                            required:'USN is required',
                            pattern:{ value:/^4SN\d{2}[A-Z]{2}\d{3}$/i, message:'Format: 4SN22CS001' }
                          })}
                          placeholder="4SN22CS001"
                          className="input pl-10 font-mono uppercase tracking-wider"
                          onChange={e => { e.target.value = e.target.value.toUpperCase() }}
                        />
                      </div>
                      {errors.usn && <p className="text-xs text-red-500 mt-1.5">⚠ {errors.usn.message}</p>}
                    </div>
                  </>
                )}

                <button type="submit" disabled={loading}
                  className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg`}
                  style={{
                    background: portal.id==='staff'
                      ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                      : portal.id==='student'
                      ? 'linear-gradient(135deg,#059669,#0d9488)'
                      : 'linear-gradient(135deg,#e11d48,#f43f5e)',
                    boxShadow: loading ? 'none' : '0 4px 16px rgba(0,0,0,0.2)',
                    opacity: loading ? 0.7 : 1,
                  }}>
                  {loading
                    ? <><Spinner size="sm"/>Signing in…</>
                    : <>{portal.badge} Sign in to {portal.label}</>
                  }
                </button>
              </form>
            </div>
          )}

          {/* ── Forgot password ── */}
          {view === 'forgot' && (
            <div>
              <button onClick={() => setView('form')}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 group">
                <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </div>
                Back to login
              </button>
              <h2 className="text-2xl font-black text-white mb-1">Reset Password</h2>
              <p className="text-white/60 text-sm mb-6">Enter your staff email for a reset link.</p>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input {...forgotForm.register('email',{required:true})} type="email" className="input pl-10" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg"
                  style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',boxShadow:'0 4px 20px rgba(99,102,241,0.4)'}}>
                  {loading ? <Spinner size="sm"/> : 'Send Reset Link'}
                </button>
              </form>
            </div>
          )}

          {/* ── Sent ── */}
          {view === 'sent' && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 mb-5 shadow-lg">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Check Your Email</h2>
              <p className="text-white/60 text-sm mb-6 leading-relaxed">
                A password reset link has been sent if that email is registered with EduGuard.
              </p>
              <button onClick={() => { setView('portals'); setPortal(null) }}
                className="w-full py-3 rounded-xl font-bold text-sm border-2 border-white/20 text-white hover:bg-white/10 transition-colors">
                ← Back to Login
              </button>
            </div>
          )}

          <p className="text-center text-xs text-white/30 mt-8">
            © {new Date().getFullYear()} EduGuard
          </p>
        </div>
      </div>
    </div>
  )
}
