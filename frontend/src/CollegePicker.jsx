import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Info, Search } from 'lucide-react'
import { api } from './api.jsx'

const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * A searchable list of every Tamil Nadu engineering college with its counselling code.
 * The person types a name or a code and must choose a row; "not in the list" opens manual entry.
 */
export default function CollegePicker({ code, name, onChange, student }) {
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const [manual, setManual] = useState(false)
  const box = useRef(null)
  useEffect(() => { api('/public/colleges').then(setAll).catch(() => setAll([])) }, [])
  useEffect(() => {
    const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])
  const picked = useMemo(() => (all || []).find((c) => c.code === code), [all, code])
  const hits = useMemo(() => {
    const n = norm(q)
    const rows = (all || []).filter((c) => !n || norm(c.name).includes(n) || norm(c.code).startsWith(n) || norm(c.district).startsWith(n))
    if (n) rows.sort((a, b) => (norm(b.code) === n) - (norm(a.code) === n) || norm(b.name).startsWith(n) - norm(a.name).startsWith(n))
    return rows.slice(0, 40)
  }, [all, q])
  const pick = (c) => { onChange({ college_code: c.code, college_name: c.name }); setQ(''); setOpen(false) }
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAt((x) => Math.min(x + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((x) => Math.max(x - 1, 0)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (hits[at]) pick(hits[at]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  if (manual) {
    return (
      <div>
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <label className="block"><span className="label">College code</span><input className="input uppercase" value={code} onChange={(e) => onChange({ college_code: e.target.value.toUpperCase(), college_name: name })} required /></label>
          <label className="block"><span className="label">College name</span><input className="input" value={name} onChange={(e) => onChange({ college_code: code, college_name: e.target.value })} placeholder="Full name of your college" required /></label>
        </div>
        <button type="button" className="mt-2 text-sm font-semibold text-brand-600" onClick={() => { setManual(false); onChange({ college_code: '', college_name: '' }) }}>Back to the college list</button>
      </div>
    )
  }

  return (
    <div ref={box} className="relative">
      <label htmlFor="college-pick" className="label">College</label>
      {picked && !open ? (
        <button type="button" id="college-pick" onClick={() => { setOpen(true); setAt(0) }} className="input flex h-auto min-h-[48px] items-center justify-between gap-3 py-2 text-left">
          <span className="flex min-w-0 items-center gap-3"><Building2 size={18} className="shrink-0 text-brand-600" />
            <span className="min-w-0"><span className="block truncate font-semibold text-navy">{picked.name}</span><span className="block text-xs text-muted">Code {picked.code}{picked.district ? ` · ${picked.district}` : ''}</span></span></span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600">Change<ChevronDown size={15} /></span>
        </button>
      ) : (
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id="college-pick" className="input pl-10" role="combobox" aria-expanded={open} aria-controls="college-list" aria-autocomplete="list" autoComplete="off" autoFocus={!!picked}
            placeholder="Type your college name or code" value={q} onFocus={() => setOpen(true)} onKeyDown={key}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setAt(0) }} />
        </div>
      )}
      {open && (
        <ul id="college-list" role="listbox" className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
          {!all && <li className="p-3 text-sm text-muted">Loading colleges…</li>}
          {hits.map((c, i) => (
            <li key={c.code} role="option" aria-selected={i === at} onMouseEnter={() => setAt(i)} onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 ${i === at ? 'bg-brand-50' : ''}`}>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-navy">{c.name}</span><span className="block text-xs text-muted">Code {c.code}{c.district ? ` · ${c.district}` : ''}</span></span>
              {c.registered && <span className="chip shrink-0 bg-leaf-50 text-leaf-600"><Check size={12} />On Credora</span>}
            </li>
          ))}
          {all && !hits.length && <li className="p-3 text-sm text-muted">No college matches “{q}”.</li>}
          {all && <li className="mt-1 border-t border-line pt-1"><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50" onMouseDown={(e) => { e.preventDefault(); setManual(true); setOpen(false); onChange({ college_code: '', college_name: '' }) }}>My college is not in the list</button></li>}
        </ul>
      )}
      {!picked && !open && <p className="mt-1.5 text-xs text-muted">All Tamil Nadu engineering colleges are listed with their counselling code. Choose yours from the list.</p>}
      {picked && !open && (
        <p className={`mt-2 flex items-start gap-2 text-sm ${picked.registered ? 'text-leaf-600' : 'text-sun-600'}`}>
          {picked.registered ? <><Check size={16} className="mt-0.5 shrink-0" />{picked.name} is on Credora.</>
            : <><Info size={16} className="mt-0.5 shrink-0" />{student ? 'Your college has not joined Credora yet. You can sign up now, and your dashboard opens as soon as your placement cell registers.' : 'Your college is not on Credora yet. You will register it and import its students in the next step.'}</>}
        </p>
      )}
    </div>
  )
}
