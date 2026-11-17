import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const TOKEN_KEY = 'credora_token'
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } }

/** Call the API. `body` sends JSON, `form` sends files (FormData). Throws an Error with the server's message. */
export async function api(path, { method, body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null) payload.append(k, v) })
  } else if (body) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, { method: method || (payload ? 'POST' : 'GET'), headers, body: payload })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? 'Please fill in every required field' : 'Something went wrong')
  }
  return data
}

/** Download a protected file and hand it to the browser to save or open. */
export async function download(path, { open } = {}) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  if (open) { window.open(url, '_blank', 'noopener'); return }
  const name = (res.headers.get('content-disposition') || '').match(/filename="?([^"]+)"?/)?.[1] || 'download'
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); return null }
    try { const u = await api('/me'); setUser(u); return u } catch { setToken(null); setUser(null); return null }
  }, [])

  useEffect(() => {
    api('/meta').then(setMeta).catch(() => {})
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const signIn = (res) => { setToken(res.token); setUser(res.user) }
  const signOut = () => { setToken(null); setUser(null) }

  return <AuthCtx.Provider value={{ user, setUser, meta, loading, refresh, signIn, signOut }}>{children}</AuthCtx.Provider>
}

/** Small data-loading hook: returns [data, reload, loading]. */
export function useLoad(path, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    if (!path) return Promise.resolve()
    setLoading(true)
    return api(path).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])
  useEffect(() => { load() }, [load])
  return [data, load, loading]
}
