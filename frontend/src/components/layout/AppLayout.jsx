import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, Bell, BrainCircuit,
  Settings, LogOut, Menu, X, Sun, Moon, ChevronDown,
  Building2, ShieldCheck, Activity, User, Heart
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

function Avatar({ user, size='sm' }) {
  const initials = user?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
  const sz = size==='sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  const colorByRole = {
    super_admin:'bg-purple-600', hod:'bg-blue-600',
    faculty:'bg-teal-600', student:'bg-indigo-600', parent:'bg-pink-600',
  }
  return (
    <div className={classNames('flex items-center justify-center rounded-lg text-white font-bold select-none', sz, colorByRole[user?.role]||'bg-brand-600')}>
      {initials}
    </div>
  )
}

export default function AppLayout({ children }) {
  const { user, logout, isStudent, isParent } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const isPortalUser = isStudent || isParent
  const visibleNav = isPortalUser ? [] : STAFF_NAV.filter(n => n.roles.includes(user?.role))

  const portalNav = isStudent
    ? [{ to:'/my-profile', icon:User,  label:'My Profile' },
       { to:'/my-profile', icon:Activity, label:'Risk Analysis' }]
    : isParent
    ? [{ to:'/my-profile', icon:Heart, label:"My Ward's Profile" }]
    : []

  const allNav = isPortalUser ? portalNav : visibleNav

  const handleLogout = async () => { await logout(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border dark:border-surface-dark-border">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-600 shadow-lg shadow-brand-500/30">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-100 tracking-tight">EduGuard</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isStudent ? 'Student Portal' : isParent ? 'Parent Portal' : 'Risk Intelligence'}
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-surface-border dark:border-surface-dark-border">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary">
          <Avatar user={user} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {ROLE_LABELS[user?.role]}{user?.department_code ? ` · ${user.department_code}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {allNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={`${to}-${label}`} to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => classNames('nav-link', isActive && 'nav-link-active')}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-surface-border dark:border-surface-dark-border pt-3">
        <button onClick={toggle} className="nav-link w-full">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        {!isPortalUser && (
          <NavLink to="/settings" className={({ isActive }) => classNames('nav-link', isActive && 'nav-link-active')}>
            <Settings className="h-4 w-4" /> Settings
          </NavLink>
        )}
        <button onClick={handleLogout} className="nav-link w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary dark:bg-surface-dark">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-surface-dark-secondary border-r border-surface-border dark:border-surface-dark-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-surface-dark-secondary flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center gap-4 px-4 lg:px-6 bg-white dark:bg-surface-dark-secondary border-b border-surface-border dark:border-surface-dark-border flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn-icon">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <button onClick={toggle} className="btn-icon hidden sm:flex">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {!isPortalUser && (
            <NavLink to="/alerts" className="btn-icon relative">
              <Bell className="h-4 w-4" />
            </NavLink>
          )}
          {/* User dropdown */}
          <div className="relative">
            <button onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary transition-colors">
              <Avatar user={user} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
                {user?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 card py-1 z-20 shadow-lg">
                <div className="px-3 py-2 border-b border-surface-border dark:border-surface-dark-border">
                  <div className="text-sm font-medium dark:text-slate-200">{user?.full_name}</div>
                  <div className="text-xs text-slate-500">{user?.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5 capitalize">{ROLE_LABELS[user?.role]}</div>
                </div>
                {!isPortalUser && (
                  <NavLink to="/settings" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary dark:text-slate-300">
                    <Settings className="h-4 w-4" /> Settings
                  </NavLink>
                )}
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
