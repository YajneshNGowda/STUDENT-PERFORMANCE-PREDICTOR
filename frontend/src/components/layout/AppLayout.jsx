import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, Bell, BrainCircuit,
  Settings, LogOut, Menu, Sun, Moon, ChevronDown,
  Building2, ShieldCheck, Activity, User, Heart, Sparkles
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { classNames, ROLE_LABELS } from '../../utils/helpers'

const STAFF_NAV = [
  { to:'/dashboard',   icon:LayoutDashboard, label:'Dashboard',       roles:['super_admin','hod','faculty'] },
  { to:'/students',    icon:GraduationCap,   label:'Students',        roles:['super_admin','hod','faculty'] },
  { to:'/alerts',      icon:Bell,            label:'Alerts',          roles:['super_admin','hod','faculty'] },
  { to:'/model',       icon:BrainCircuit,    label:'Model & Metrics', roles:['super_admin','hod','faculty'] },
  { to:'/users',       icon:Users,           label:'User Management', roles:['super_admin','hod'] },
  { to:'/departments', icon:Building2,       label:'Departments',     roles:['super_admin'] },
]

const ROLE_GRADIENT = {
  super_admin: 'from-purple-600 to-violet-600',
  hod:         'from-blue-600   to-cyan-500',
  faculty:     'from-teal-600   to-emerald-500',
  student:     'from-indigo-500 to-brand-600',
  parent:      'from-pink-500   to-rose-500',
}

function Avatar({ user, size = 'sm' }) {
  const initials = user?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  const grad = ROLE_GRADIENT[user?.role] || 'from-brand-500 to-brand-600'
  return (
    <div className={classNames(
      'flex items-center justify-center rounded-xl font-bold text-white select-none bg-gradient-to-br shadow-sm flex-shrink-0',
      sz, grad
    )}>
      {initials}
    </div>
  )
}

export default function AppLayout({ children }) {
  const { user, logout, isStudent, isParent } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const isPortalUser = isStudent || isParent
  const visibleNav   = isPortalUser ? [] : STAFF_NAV.filter(n => n.roles.includes(user?.role))

  const portalNav = isStudent
    ? [{ to:'/my-profile', icon:User,     label:'My Profile' },
       { to:'/my-profile', icon:Activity, label:'Risk Analysis' }]
    : isParent
    ? [{ to:'/my-profile', icon:Heart, label:"My Ward's Profile" }]
    : []

  const allNav = isPortalUser ? portalNav : visibleNav
  const handleLogout = async () => { await logout(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* ── Logo ─────────────────────────────────── */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/40">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-white dark:border-gray-900 shadow-sm" />
          </div>
          <div>
            <div className="font-extrabold text-slate-800 dark:text-white tracking-tight text-lg leading-none">
              Edu<span className="text-gradient">Guard</span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {isStudent ? 'Student Portal' : isParent ? 'Parent Portal' : 'Risk Intelligence'}
            </div>
          </div>
        </div>
      </div>

      {/* ── User card ────────────────────────────── */}
      <div className="mx-3 mb-3">
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700/50 border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
          <Avatar user={user} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{user?.full_name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {ROLE_LABELS[user?.role]}{user?.department_code ? ` · ${user.department_code}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav section label ────────────────────── */}
      {allNav.length > 0 && (
        <div className="px-5 mb-1">
          <span className="section-label">Navigation</span>
        </div>
      )}

      {/* ── Nav links ────────────────────────────── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
        {allNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={`${to}-${label}`} to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => classNames('nav-link', isActive && 'nav-link-active')}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom controls ──────────────────────── */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
        <div className="px-2 mb-1">
          <span className="section-label">Preferences</span>
        </div>
        <button onClick={toggle}
          className="nav-link w-full justify-between group">
          <span className="flex items-center gap-3">
            {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-500" />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </span>
          <div className={classNames(
            'w-9 h-5 rounded-full transition-colors relative',
            dark ? 'bg-brand-600' : 'bg-slate-300'
          )}>
            <div className={classNames(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
              dark ? 'left-4' : 'left-0.5'
            )} />
          </div>
        </button>

        {!isPortalUser && (
          <NavLink to="/settings"
            className={({ isActive }) => classNames('nav-link', isActive && 'nav-link-active')}>
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        )}

        <button onClick={handleLogout}
          className="nav-link w-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{background: dark ? '#0a0f1e' : '#f4f6fb'}}>

      {/* ── Desktop sidebar ── */}
      <aside className={classNames(
        'hidden lg:flex flex-col flex-shrink-0 border-r',
        'bg-white dark:bg-gray-900',
        'border-slate-200 dark:border-slate-800',
        'shadow-sidebar'
      )} style={{width:264}}>
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 flex flex-col z-10 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Topbar ── */}
        <header className={classNames(
          'h-16 flex items-center gap-3 px-4 lg:px-6 flex-shrink-0 z-30',
          'bg-white/80 dark:bg-gray-900/80 backdrop-blur-md',
          'border-b border-slate-200 dark:border-slate-800'
        )}>
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden btn-icon h-9 w-9">
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb / title area */}
          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggle} className="btn-icon h-9 w-9 hidden sm:flex">
              {dark
                ? <Sun className="h-4 w-4 text-amber-400" />
                : <Moon className="h-4 w-4" />}
            </button>

            {!isPortalUser && (
              <NavLink to="/alerts" className="btn-icon h-9 w-9 relative">
                <Bell className="h-4 w-4" />
                <div className="notif-dot" />
              </NavLink>
            )}

            {/* User dropdown */}
            <div className="relative ml-1">
              <button onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <Avatar user={user} />
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                    {user?.full_name?.split(' ')[0]}
                  </div>
                  <div className="text-xs text-slate-400 capitalize">{ROLE_LABELS[user?.role]}</div>
                </div>
                <ChevronDown className={classNames(
                  'h-3.5 w-3.5 text-slate-400 transition-transform',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 card py-1 z-50 shadow-xl animate-in">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</div>
                        <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                        <div className="text-xs font-medium text-brand-500 mt-0.5">{ROLE_LABELS[user?.role]}</div>
                      </div>
                    </div>
                  </div>

                  {!isPortalUser && (
                    <NavLink to="/settings" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <Settings className="h-4 w-4 text-slate-400" />
                      Account Settings
                    </NavLink>
                  )}

                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-in max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
