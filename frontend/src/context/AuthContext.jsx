import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('eg_token'))
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async (t) => {
    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`
      const { data } = await api.get('/api/auth/me')
      setUser(data)
    } catch {
      setToken(null)
      setUser(null)
      localStorage.removeItem('eg_token')
      delete api.defaults.headers.common['Authorization']
    }
  }, [])

  useEffect(() => {
    if (token) {
      loadMe(token).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token, loadMe])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    const { access_token, user: u } = data
    localStorage.setItem('eg_token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setToken(access_token)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout') } catch {}
    localStorage.removeItem('eg_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'super_admin'
  const isHOD   = user?.role === 'hod'
  const isFaculty = user?.role === 'faculty'
  const canViewAll = isAdmin
  const canViewDept = isAdmin || isHOD

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout,
      isAdmin, isHOD, isFaculty,
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
