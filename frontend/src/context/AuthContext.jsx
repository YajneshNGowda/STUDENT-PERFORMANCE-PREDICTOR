import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { authAPI } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('eg_token'))
  const [loading, setLoading] = useState(true)

  const _setAuth = useCallback((tok, u) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${tok}`
    setToken(tok); setUser(u)
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    authAPI.me().then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('eg_token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login(email, password)
    localStorage.setItem('eg_token', data.access_token)
    _setAuth(data.access_token, data.user)
    return data.user
  }, [_setAuth])

  const studentLogin = useCallback(async (full_name, usn) => {
    const { data } = await authAPI.studentLogin(full_name, usn)
    localStorage.setItem('eg_token', data.access_token)
    _setAuth(data.access_token, data.user)
    return data.user
  }, [_setAuth])

  const parentLogin = useCallback(async (full_name, usn) => {
    const { data } = await authAPI.parentLogin(full_name, usn)
    localStorage.setItem('eg_token', data.access_token)
    _setAuth(data.access_token, data.user)
    return data.user
  }, [_setAuth])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('eg_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null); setUser(null)
  }, [])

  const isAdmin   = user?.role === 'super_admin'
  const isHOD     = user?.role === 'hod'
  const isFaculty = user?.role === 'faculty'
  const isStudent = user?.role === 'student'
  const isParent  = user?.role === 'parent'
  const isStaff   = ['super_admin','hod','faculty'].includes(user?.role)
  const canViewAll  = isAdmin
  const canViewDept = isAdmin || isHOD

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, studentLogin, parentLogin, logout,
      isAdmin, isHOD, isFaculty, isStudent, isParent, isStaff,
      canViewAll, canViewDept,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
