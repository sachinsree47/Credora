import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useInView } from 'framer-motion'
import { AlertTriangle, Check, CheckCircle2, FileUp, Info, Loader2, Moon, ShieldCheck, Sun, X, XCircle } from 'lucide-react'

export const ease = [0.22, 1, 0.36, 1]
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }
export const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }

/** Logo mark + word. */
export function Logo({ light, small }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <motion.span whileHover={{ rotate: -8, scale: 1.08 }} className={`grid place-items-center rounded-xl bg-brand-600 text-white ${small ? 'h-8 w-8' : 'h-9 w-9'}`}>
        <ShieldCheck size={small ? 18 : 20} strokeWidth={2.4} />
      </motion.span>
      <span className={`font-display font-bold tracking-tight ${small ? 'text-lg' : 'text-xl'} ${light ? 'text-white' : 'text-navy'}`}>Credora</span>
    </span>
  )
}

const VARIANTS = { primary: 'btn-primary', ghost: 'btn-ghost', soft: 'btn-soft', leaf: 'btn-leaf', danger: 'btn-danger' }
/** Light / dark switch. The choice is remembered on this device. */
export function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    window.addEventListener('credora-theme', sync)
    return () => window.removeEventListener('credora-theme', sync)
  }, [])
  const flip = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('credora_theme', next ? 'dark' : 'light') } catch { /* private mode */ }
    window.dispatchEvent(new Event('credora-theme'))
  }
  return (
    <button type="button" onClick={flip} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}
      className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-navy hover:bg-brand-50 ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'moon' : 'sun'} initial={{ y: 18, opacity: 0, rotate: -60 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -18, opacity: 0, rotate: 60 }} transition={{ duration: 0.25 }}>
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }) {
  return (
    <motion.button whileHover={props.disabled ? undefined : { y: -1.5 }} whileTap={props.disabled ? undefined : { scale: 0.97 }}
      className={`${VARIANTS[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </motion.button>
  )
}

/** Card that fades up when it scrolls into view and lifts on hover. */
export function Card({ children, className = '', hover = false, delay = 0, ...props }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease, delay }} whileHover={hover ? { y: -4, boxShadow: '0 18px 40px -14px rgba(36,86,214,0.32)' } : undefined}
      className={`card ${className}`} {...props}>
      {children}
    </motion.div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const tones = {
  ok: 'bg-leaf-50 text-leaf-600', warn: 'bg-sun-50 text-sun-600', bad: 'bg-rose-50 text-rose-600',
  info: 'bg-brand-50 text-brand-700', mute: 'bg-surface2 text-muted',
}
export function Badge({ tone = 'info', children, icon: Icon }) {
  return <span className={`chip ${tones[tone]}`}>{Icon && <Icon size={13} />}{children}</span>
}

/** Number that counts up when it first becomes visible. */
export function Counter({ value, className = '' }) {
  const ref = useRef(null)
  const seen = useInView(ref, { once: true })
  useEffect(() => {
    if (!seen || !ref.current) return
    const c = animate(0, Number(value) || 0, { duration: 1.1, ease, onUpdate: (v) => { if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('en-IN') } })
    return () => c.stop()
  }, [seen, value])
  return <span ref={ref} className={className}>0</span>
}

export function Stat({ icon: Icon, label, value, tone = 'brand', delay = 0 }) {
  const bg = { brand: 'bg-brand-50 text-brand-600', sun: 'bg-sun-50 text-sun-600', leaf: 'bg-leaf-50 text-leaf-600' }[tone]
  return (
    <Card hover delay={delay} className="p-5">
      <div className="flex items-center justify-between">
        <Counter value={value} className="font-display text-3xl font-bold text-navy" />
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${bg}`}><Icon size={20} /></span>
      </div>
      <div className="mt-2 text-sm text-muted">{label}</div>
    </Card>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  // Rendered into <body> so the dialog always covers the whole screen, whatever is animating around it.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3, ease }} className={`card relative z-10 max-h-[88vh] w-full overflow-y-auto p-6 ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold">{title}</h3>
              <button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-50"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random()
    setItems((x) => [...x, { id, text, tone }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200)
  }, [])
  const icons = { ok: CheckCircle2, bad: XCircle, warn: AlertTriangle, info: Info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = icons[t.tone] || Info
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
                className="card flex items-start gap-3 p-3.5 shadow-lift">
                <span className={`mt-0.5 ${t.tone === 'bad' ? 'text-rose-600' : t.tone === 'warn' ? 'text-sun-600' : 'text-leaf-500'}`}><I size={18} /></span>
                <span className="text-sm text-ink">{t.text}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/** Drag-and-drop file picker with an animated "added" state. */
export function FileDrop({ label, hint, file, onFile, accept = '.png,.jpg,.jpeg,.pdf' }) {
  const [over, setOver] = useState(false)
  const ref = useRef(null)
  return (
    <motion.button type="button" onClick={() => ref.current?.click()} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]) }}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed p-4 text-left transition-colors ${file ? 'border-leaf-500 bg-leaf-50' : over ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:border-brand-400'}`}>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <motion.span key={file ? 'y' : 'n'} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${file ? 'bg-leaf-500 text-white' : 'bg-brand-50 text-brand-600'}`}>
        {file ? <Check size={22} /> : <FileUp size={22} />}
      </motion.span>
      <span className="min-w-0">
        <span className="block font-semibold text-navy">{label}</span>
        <span className="block truncate text-sm text-muted">{file ? file.name : hint}</span>
      </span>
    </motion.button>
  )
}

export function Skeleton({ rows = 3 }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
}

export function Empty({ icon: Icon = Info, title, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-10 text-center">
      <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5 }} className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon size={24} /></motion.span>
      <div className="font-display font-semibold text-navy">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </motion.div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </motion.div>
  )
}

/** Password strength meter: returns score 0-4 and what is missing. */
export function strength(pw) {
  const rules = [[pw.length >= 8, '8 or more characters'], [/[a-z]/.test(pw) && /[A-Z]/.test(pw), 'upper and lower case letters'], [/\d/.test(pw), 'a number'], [/[^A-Za-z0-9]/.test(pw), 'a symbol']]
  return { score: pw ? rules.filter((r) => r[0]).length : 0, missing: rules.filter((r) => !r[0]).map((r) => r[1]) }
}
export function StrengthMeter({ pw }) {
  const { score, missing } = strength(pw)
  const color = ['bg-line', 'bg-rose-600', 'bg-sun-500', 'bg-brand-500', 'bg-leaf-500'][score]
  const label = ['Password strength', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return (
    <div aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <motion.div className={`h-full ${color}`} initial={false} animate={{ width: i <= score ? '100%' : '0%' }} transition={{ duration: 0.35, ease }} />
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted"><span className="font-semibold text-ink">{label}.</span> {pw && (missing.length ? `Add ${missing.join(', ')}.` : 'Meets every rule.')}</p>
    </div>
  )
}

export const fmtDate = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }


/** One announcement about the next steps of a drive. */
export function Notice({ n, label }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span><b className="text-navy">{label || n.org}</b> · {n.author} · {n.date}</span>
        {n.event_date && <span className="chip bg-sun-50 text-sun-600">First round {fmtDate(n.event_date)}</span>}
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{n.body}</p>
    </div>
  )
}
