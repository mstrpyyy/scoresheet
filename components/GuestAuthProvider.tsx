'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'guest-token'

interface AuthCtx {
  token: string | null
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>
}

const Ctx = createContext<AuthCtx>({ token: null, apiFetch: fetch })

export function GuestAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      const m = document.cookie.match(/(?:^|;\s*)guest-token=([^;]+)/)
      if (m) {
        stored = decodeURIComponent(m[1])
        localStorage.setItem(STORAGE_KEY, stored)
      }
    }
    setToken(stored)
  }, [])

  const apiFetch = useCallback(
    (url: string, options: RequestInit = {}): Promise<Response> => {
      const t = token ?? localStorage.getItem(STORAGE_KEY)
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
          ...(options.headers ?? {}),
        },
      })
    },
    [token],
  )

  return <Ctx.Provider value={{ token, apiFetch }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
