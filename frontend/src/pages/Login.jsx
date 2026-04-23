import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ShieldCheck, Mail, Lock, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../utils/api'
import { Spinner } from '../components/ui/index.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [view, setView] = useState('login') // 'login' | 'forgot' | 'sent'
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm()
  const forgotForm = useForm()

  const onLogin = async ({ email, password }) => {
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const onForgot = async ({ email }) => {
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setView('sent')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-600 shadow-xl shadow-brand-500/30 mb-4">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">EduGuard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Student Risk Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* ── Login view ── */}
          {view === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Sign in to your account</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Enter your credentials to continue</p>

              <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      {...register('email', { required: 'Email is required' })}
                      type="email" placeholder="you@college.edu"
                      className="input pl-9"
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      {...register('password', { required: 'Password is required' })}
                      type={showPass ? 'text' : 'password'} placeholder="••••••••"
                      className="input pl-9 pr-10"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <Spinner size="sm" /> : 'Sign In'}
                </button>
              </form>

              {/* Demo credentials */}
              <div className="mt-6 p-4 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary border border-surface-border dark:border-surface-dark-border">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">Demo Accounts</p>
                <div className="space-y-1.5 text-xs font-mono">
                  {[
                    { role: 'Super Admin', email: 'admin@eduguard.edu', pass: 'Admin@123' },
                    { role: 'HOD (CSE)', email: 'hod.cse@eduguard.edu', pass: 'Hod@1234' },
                    { role: 'Faculty', email: 'faculty.cse1@eduguard.edu', pass: 'Faculty@123' },
                  ].map(({ role, email, pass }) => (
                    <div key={role} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="w-24 font-sans font-medium text-slate-700 dark:text-slate-300">{role}</span>
                      <span className="text-brand-600 dark:text-brand-400">{email}</span>
                      <span className="text-slate-400">/ {pass}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Forgot password view ── */}
          {view === 'forgot' && (
            <>
              <button onClick={() => setView('login')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Reset your password</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Enter your email and we'll send a reset link.</p>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input {...forgotForm.register('email', { required: true })} type="email" className="input pl-9" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <Spinner size="sm" /> : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          {/* ── Sent view ── */}
          {view === 'sent' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <Mail className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">A password reset link has been sent if that email is registered.</p>
              <button onClick={() => setView('login')} className="btn-secondary w-full justify-center">Back to Sign In</button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} EduGuard · Early Warning System
        </p>
      </div>
    </div>
  )
}
