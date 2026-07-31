import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string, accountType: 'client' | 'workspace') => Promise<User>
  signup: (fullName: string, email: string, phone: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('atelier_access_token')) {
      setLoading(false)
      return
    }
    api<User>('/auth/me').then(setUser).catch(() => {
      localStorage.removeItem('atelier_access_token')
      localStorage.removeItem('atelier_refresh_token')
    }).finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signup: async (fullName, email, phone, password) => {
      const tokens = await api<{ access_token: string; refresh_token: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ full_name: fullName, email, phone, password }),
      })
      localStorage.setItem('atelier_access_token', tokens.access_token)
      localStorage.setItem('atelier_refresh_token', tokens.refresh_token)
      const profile = await api<User>('/auth/me')
      setUser(profile)
      return profile
    },
    login: async (email, password, accountType) => {
      const tokens = await api<{ access_token: string; refresh_token: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password, account_type: accountType }),
      })
      localStorage.setItem('atelier_access_token', tokens.access_token)
      localStorage.setItem('atelier_refresh_token', tokens.refresh_token)
      const profile = await api<User>('/auth/me')
      setUser(profile)
      return profile
    },
    logout: () => {
      localStorage.removeItem('atelier_access_token')
      localStorage.removeItem('atelier_refresh_token')
      setUser(null)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
