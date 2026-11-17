import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { QrCode, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { api } from '../api.jsx'
import { Button, Card, Logo, ThemeToggle } from '../ui.jsx'

/** Certificate checker used on the public page and inside the recruiter dashboard. */
export function CertCheck({ initial = '' }) {
  const [id, setId] = useState(initial)
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (value) => {
    const v = (value ?? id).trim()
    if (!v) return
    setBusy(true); setRes(null)
    try { setRes(await api(`/public/verify/${encodeURIComponent(v)}`)) } catch { setRes({ found: false }) } finally { setBusy(false) }
  }
  useEffect(() => { if (initial) run(initial) }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const c = res?.certificate
  const good = res?.found && res.valid
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); run() }} className="flex flex-wrap gap-3">
          <span className="relative min-w-[220px] flex-1"><QrCode size={17} className="absolute left-3.5 top-3.5 text-muted" /><input aria-label="Certificate ID" className="input pl-10 font-mono uppercase" placeholder="CRD-XXXXXXXXXX" value={id} onChange={(e) => setId(e.target.value)} /></span>
          <Button loading={busy}><Search size={16} />Verify</Button>
        </form>
      </Card>
      <AnimatePresence mode="wait">
        {res && (
          <motion.div key={res.found ? c.id + res.valid : 'none'} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mt-5 overflow-hidden">
            <div className={`flex items-center gap-4 p-6 text-white ${good ? 'bg-gradient-to-r from-leaf-500 to-leaf-600' : 'bg-gradient-to-r from-rose-600 to-[#9F2019]'}`}>
              <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }} className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20">
                {good ? <ShieldCheck size={34} /> : <ShieldX size={34} />}
              </motion.span>
              <div>
                <div className="font-display text-2xl font-bold">{good ? 'Genuine certificate' : res.found ? 'Signature does not match' : 'Certificate not found'}</div>
                <div className="text-sm text-white/90">{good ? `Digitally signed by ${c.college} and unchanged since it was issued.` : res.found ? 'This record was changed after it was signed. Do not trust it.' : 'No certificate with this ID was issued through Credora.'}</div>
              </div>
            </div>
            {res.found && (
              <motion.dl initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }} className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
                {[['Certificate', c.title], ['Type', c.kind], ['Issued to', c.student_name], ['Roll number', c.roll_no], ['Department', `${c.department}, batch ${c.batch}`], ['College', `${c.college} (${c.college_code})`], ['Issued by', c.issued_by], ['Issued on', c.issued_on]].map(([k, v]) => (
                  <motion.div key={k} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-0.5 font-medium text-navy">{v}</dd>
                  </motion.div>
                ))}
                {c.details && <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Details</dt><dd className="mt-0.5 text-ink">{c.details}</dd></div>}
                <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Ed25519 signature</dt><dd className="mt-0.5 break-all font-mono text-xs text-muted">{res.signature}</dd></div>
              </motion.dl>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function VerifyCert() {
  const { id } = useParams()
  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8">
      <div className="blob -left-20 top-10 h-72 w-72 bg-brand-100" />
      <div className="blob -right-10 bottom-10 h-64 w-64 bg-leaf-50" style={{ animationDelay: '-6s' }} />
      <header className="relative mx-auto flex max-w-2xl items-center justify-between"><Link to="/"><Logo /></Link><span className="flex items-center gap-2"><ThemeToggle /><Link to="/login" className="btn-ghost">Log in</Link></span></header>
      <div className="relative mx-auto mt-10 max-w-2xl text-center">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold sm:text-4xl">Check a certificate</motion.h1>
        <p className="mt-2 text-muted">Scan the QR code on a Credora certificate, or type its ID. No account is needed.</p>
      </div>
      <div className="relative mt-8"><CertCheck initial={id || ''} /></div>
    </div>
  )
}
