import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Award, BadgeCheck, Building2, CalendarClock, CheckCircle2, ClipboardCheck, ExternalLink, FileSearch, FileText, FileUp, Info, QrCode, Search, Share2, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, XCircle , Megaphone } from 'lucide-react'
import { api, useAuth, useLoad } from '../api.jsx'
import { Badge, Button, Card, Empty, Field, FileDrop, Modal, Notice, PageHead, Skeleton, Stat, ease, fmtDate, rise, stagger, useToast } from '../ui.jsx'

export default function Student({ tab }) {
  return { overview: <Overview />, opportunities: <Opportunities />, check: <Check />, applications: <Applications />, wallet: <Wallet />, shared: <Shared /> }[tab]
}

const MATCH = { eligible: ['ok', 'You qualify'], incomplete: ['warn', 'Add details to confirm'], not_eligible: ['mute', 'Not eligible'] }
const KIND = { scholarship: 'Scholarship', internship: 'Internship', job: 'Job' }

function OppCard({ o, onApply, busy }) {
  const [tone, label] = MATCH[o.match]
  return (
    <motion.div variants={rise} layout whileHover={{ y: -3 }} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{KIND[o.kind]}</Badge>
            <Badge tone={tone}>{label}</Badge>
            {o.verified_company && <Badge tone="ok" icon={BadgeCheck}>Verified company</Badge>}
            {o.sample && <Badge tone="mute">Sample</Badge>}
          </div>
          <h3 className="mt-2.5 text-lg font-semibold">{o.title}</h3>
          <div className="mt-0.5 text-sm text-muted">{o.provider}</div>
          <p className="mt-2 text-sm text-ink">{o.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {o.amount && <span className="font-semibold text-navy">{o.amount}</span>}
            {o.deadline && <span className="inline-flex items-center gap-1.5 text-muted"><CalendarClock size={15} />Closes {fmtDate(o.deadline)}</span>}
          </div>
          {o.why.length > 0 && o.match !== 'not_eligible' && <p className="mt-2 text-sm text-leaf-600">Why you match: {o.why.join(', ')}</p>}
          {o.need.length > 0 && o.match === 'incomplete' && <p className="mt-1 text-sm text-sun-600">Add your {o.need.join(', ')} in <Link to="/app/profile" className="font-semibold underline">Profile settings</Link> to confirm.</p>}
        </div>
        {o.applied ? <Badge tone="ok" icon={CheckCircle2}>Applied</Badge>
          : <Button disabled={o.match === 'not_eligible'} loading={busy} onClick={() => onApply(o)}>Apply <ArrowRight size={16} /></Button>}
      </div>
    </motion.div>
  )
}

function useApply(reload) {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const apply = async (o) => {
    setBusy(o.id)
    try { await api(`/student/apply/${o.id}`, { method: 'POST' }); toast(`Applied to ${o.title}`); reload() }
    catch (e) { toast(e.message, 'bad') } finally { setBusy(null) }
  }
  return [apply, busy]
}

function Overview() {
  const { user } = useAuth()
  const [ov] = useLoad('/student/overview')
  const [opps, reload] = useLoad('/student/opportunities')
  const [apply, busy] = useApply(reload)
  const top = (opps || []).filter((o) => o.match === 'eligible' && !o.applied).slice(0, 3)
  return (
    <>
      <PageHead title={`Welcome back, ${user.name.split(' ')[0]}`} sub={`${user.department} · Batch ${user.batch} · ${user.college?.name}`}>
        <Badge tone="ok" icon={ShieldCheck}>Identity verified</Badge>
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Sparkles} label="Opportunities you qualify for" value={ov?.eligible ?? 0} />
        <Stat icon={ClipboardCheck} label="Applications sent" value={ov?.applications ?? 0} tone="sun" delay={0.06} />
        <Stat icon={Award} label="Signed certificates" value={ov?.certificates ?? 0} tone="leaf" delay={0.12} />
        <Stat icon={FileSearch} label="Offers checked" value={ov?.checks ?? 0} delay={0.18} />
      </div>
      {ov?.announcements?.length > 0 && (
        <Card className="mt-6 border-brand-200 p-5">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-navy"><Megaphone size={20} className="text-brand-600" />Announcements from your placement cell</div>
          <div className="mt-3 space-y-2">{ov.announcements.map((n) => <Notice key={n.id} n={n} label={`${n.company}: ${n.purpose}`} />)}</div>
        </Card>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Matched to you</h2>
            <Link to="/app/opportunities" className="text-sm font-semibold text-brand-600">See all</Link>
          </div>
          {!opps ? <Skeleton /> : top.length ? (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">{top.map((o) => <OppCard key={o.id} o={o} onApply={apply} busy={busy === o.id} />)}</motion.div>
          ) : <Card className="p-2"><Empty icon={Search} title="Nothing new right now">You have applied to everything you currently qualify for.</Empty></Card>}
        </div>
        <div className="space-y-4">
          <Card className="overflow-hidden p-5">
            <div className="flex items-center gap-3">
              <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="grid h-11 w-11 place-items-center rounded-xl bg-sun-50 text-sun-600"><ShieldAlert size={22} /></motion.span>
              <h3 className="text-lg font-semibold">Got an offer?</h3>
            </div>
            <p className="mt-2 text-sm text-muted">Check it before you pay a fee or share any document.</p>
            <Link to="/app/check" className="btn-primary mt-4 w-full">Check an offer</Link>
          </Card>
          <Card className="p-5" delay={0.08}>
            <h3 className="font-semibold">Your connections</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-2.5"><Building2 size={17} className="mt-0.5 text-brand-600" /><span><b className="text-navy">College:</b> {user.college?.name}, verified</span></li>
              <li className="flex items-start gap-2.5"><FileText size={17} className="mt-0.5 text-brand-600" /><span><b className="text-navy">Résumé:</b> {{ none: 'not uploaded yet', pending: 'waiting for your college', verified: 'verified by your college', rejected: 'sent back by your college' }[user.resume_status]}</span></li>
              <li className="flex items-start gap-2.5"><Share2 size={17} className="mt-0.5 text-brand-600" /><span><b className="text-navy">Placement cell:</b> shared your details {ov?.shares ?? 0} time(s)</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

function Opportunities() {
  const [opps, reload] = useLoad('/student/opportunities')
  const [apply, busy] = useApply(reload)
  const [kind, setKind] = useState('all')
  const list = (opps || []).filter((o) => kind === 'all' || o.kind === kind)
  return (
    <>
      <PageHead title="Opportunities" sub="Sorted so the ones you qualify for come first. Scholarships shown are sample data." />
      <div className="mb-5 flex flex-wrap gap-2">
        {[['all', 'All'], ['scholarship', 'Scholarships'], ['internship', 'Internships'], ['job', 'Jobs']].map(([id, label]) => (
          <button key={id} onClick={() => setKind(id)} className={`relative h-10 rounded-full px-4 text-sm font-semibold ${kind === id ? 'text-white' : 'bg-surface text-navy border border-line'}`}>
            {kind === id && <motion.span layoutId="kindPill" className="absolute inset-0 rounded-full bg-brand-600" />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
      {!opps ? <Skeleton rows={4} /> : (
        <motion.div key={kind} variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {list.map((o) => <OppCard key={o.id} o={o} onApply={apply} busy={busy === o.id} />)}
          {!list.length && <Card className="p-2"><Empty icon={Search} title="Nothing in this category yet" /></Card>}
        </motion.div>
      )}
    </>
  )
}

const VERDICT = {
  likely_scam: { label: 'Likely a scam', text: 'Do not pay or share any document.', color: '#C8322B', tone: 'bad', icon: ShieldAlert },
  suspicious: { label: 'Be careful', text: 'Some warning signs. Confirm through an official channel first.', color: '#D9640F', tone: 'warn', icon: ShieldQuestion },
  looks_safe: { label: 'Looks safe', text: 'No warning signs found. Still apply only through official channels.', color: '#17965C', tone: 'ok', icon: ShieldCheck },
  not_enough: { label: 'Not enough to judge', text: 'Paste the full message or link.', color: '#5B6480', tone: 'mute', icon: Info },
}
const SAMPLE = 'Congratulations! You are selected for an internship at Infosys without interview. Pay registration fee of Rs 2,500 via UPI within 24 hours to confirm your seat. Contact hr.infosys.careers@gmail.com or visit http://infosyss-careers.xyz/apply'

function Gauge({ score, color }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`Risk score ${score} out of 100`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * Math.max(score, 3)) / 100 }} transition={{ duration: 1.1, ease }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="font-display text-3xl font-bold" style={{ color }}>{score}</motion.div><div className="text-[11px] font-medium text-muted">risk score</div></div>
      </div>
    </div>
  )
}

function Check() {
  const toast = useToast()
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [history, reload] = useLoad('/student/checks')
  const run = async () => {
    setBusy(true); setRes(null)
    try { setRes(await api('/student/check', { form: { text, file } })); reload() } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  const v = res && VERDICT[res.verdict]
  const levelIcon = { bad: [XCircle, 'text-rose-600'], warn: [AlertTriangle, 'text-sun-600'], ok: [CheckCircle2, 'text-leaf-500'] }
  return (
    <>
      <PageHead title="Check an offer" sub="Paste a message, link or email, or upload a photo of an offer letter. You get a verdict and the reasons behind it." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <label className="label" htmlFor="offer">Message, link or email text</label>
            <textarea id="offer" className="input h-40 resize-y py-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the offer here" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button loading={busy} disabled={!text.trim() && !file} onClick={run}><FileSearch size={16} />Check now</Button>
              <label className="btn-ghost cursor-pointer"><FileUp size={16} />{file ? file.name.slice(0, 22) : 'Upload a photo'}<input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
              <button type="button" onClick={() => { setText(SAMPLE); setFile(null) }} className="text-sm font-semibold text-brand-600">Try a sample scam</button>
            </div>
          </Card>
          <AnimatePresence mode="wait">
            {busy && (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card relative overflow-hidden p-8 text-center">
                <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-brand-200/0 via-brand-200/60 to-brand-200/0" animate={{ top: ['-20%', '110%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />
                <div className="relative font-display font-semibold text-navy">Checking rules, registries and wording…</div>
              </motion.div>
            )}
            {v && !busy && (
              <motion.div key="res" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <Gauge score={res.score} color={v.color} />
                  <div className="min-w-0 flex-1">
                    <Badge tone={v.tone} icon={v.icon}>Verdict</Badge>
                    <motion.h2 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="mt-2 text-2xl font-bold" style={{ color: v.color }}>{v.label}</motion.h2>
                    <p className="mt-1 text-sm text-muted">{v.text}</p>
                  </div>
                </div>
                <h3 className="mt-6 font-semibold">Why</h3>
                <motion.ul variants={stagger} initial="hidden" animate="show" className="mt-3 space-y-2">
                  {res.reasons.map((r) => {
                    const [I, cls] = levelIcon[r.level]
                    return <motion.li key={r.text} variants={rise} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm"><I size={18} className={`mt-0.5 shrink-0 ${cls}`} />{r.text}</motion.li>
                  })}
                </motion.ul>
                {(res.found.links.length > 0 || res.found.emails.length > 0) && (
                  <p className="mt-4 break-all text-xs text-muted">Found in the text: {[...res.found.links, ...res.found.emails, ...res.found.amounts].join(' · ')}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Card className="h-fit p-5">
          <h3 className="font-semibold">Recent checks</h3>
          {!history?.length ? <Empty icon={FileSearch} title="No checks yet">Your last few checks appear here.</Empty> : (
            <ul className="mt-3 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2"><Badge tone={VERDICT[h.verdict].tone}>{VERDICT[h.verdict].label}</Badge><span className="text-xs text-muted">{h.date}</span></div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{h.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

const APP_TONE = { Submitted: 'info', 'Under review': 'warn', Shortlisted: 'ok', Selected: 'ok', 'Not selected': 'mute' }
function Applications() {
  const [apps] = useLoad('/student/applications')
  return (
    <>
      <PageHead title="My applications" sub="Everything you have applied to, in one place." />
      <Card className="p-2">
        {!apps ? <div className="p-4"><Skeleton /></div> : !apps.length ? <Empty icon={ClipboardCheck} title="No applications yet">Apply from the Opportunities page and track the status here.</Empty> : (
          <motion.ul variants={stagger} initial="hidden" animate="show">
            {apps.map((a) => (
              <motion.li key={a.id} variants={rise} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-0">
                <div><div className="font-semibold text-navy">{a.title}</div><div className="text-sm text-muted">{a.provider} · {KIND[a.kind]} · applied {a.date}</div></div>
                <Badge tone={APP_TONE[a.status] || 'info'}>{a.status}</Badge>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </Card>
    </>
  )
}

function Wallet() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [certs] = useLoad('/student/certificates')
  const [ups, reloadUps] = useLoad('/student/cert-uploads')
  const [add, setAdd] = useState(false)
  const [nc, setNc] = useState({ title: '', kind: 'Course certificate', issuer: '', file: null })
  const [saving, setSaving] = useState(false)
  const addCert = async (e) => {
    e.preventDefault(); setSaving(true)
    try { const r = await api('/student/cert-uploads', { form: nc }); toast(r.message); setAdd(false); setNc({ title: '', kind: 'Course certificate', issuer: '', file: null }); reloadUps() }
    catch (err) { toast(err.message, 'bad') } finally { setSaving(false) }
  }
  const waiting = (ups || []).filter((x) => x.status !== 'verified')
  const [qr, setQr] = useState(null)
  const [busy, setBusy] = useState(false)
  const upload = async (f) => {
    if (!f) return
    setBusy(true)
    try { setUser(await api('/student/resume', { form: { file: f } })); toast('Résumé uploaded. Your college will verify it.') } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  const rs = { none: ['mute', 'Not uploaded'], pending: ['warn', 'Waiting for your college'], verified: ['ok', 'Verified by your college'], rejected: ['bad', 'Sent back by your college'] }[user.resume_status]
  return (
    <>
      <PageHead title="Credential wallet" sub="Your résumé and every certificate your college has signed." />
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600"><FileText size={22} /></span>
          <div><div className="font-semibold text-navy">Résumé (PDF)</div><div className="mt-1"><Badge tone={rs[0]}>{rs[1]}</Badge></div></div>
        </div>
        <label className={`btn-primary cursor-pointer ${busy ? 'opacity-60' : ''}`}><FileUp size={16} />{user.resume_status === 'none' ? 'Upload résumé' : 'Replace résumé'}<input type="file" accept=".pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} /></label>
      </Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Certificates</h2><p className="text-sm text-muted">Add certificates you already hold. Your college checks each one against the original and signs it.</p></div>
        <Button onClick={() => setAdd(true)}><FileUp size={16} />Add a certificate</Button>
      </div>
      {waiting.length > 0 && (
        <Card className="mb-5 p-2">
          <ul>{waiting.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-0">
              <div><div className="font-semibold text-navy">{x.title}</div><div className="text-sm text-muted">{x.kind}{x.issuer ? ` · ${x.issuer}` : ''} · uploaded {x.date}</div></div>
              <Badge tone={x.status === 'pending' ? 'warn' : 'bad'}>{x.status === 'pending' ? 'Waiting for your college' : 'Sent back by your college'}</Badge>
            </li>
          ))}</ul>
        </Card>
      )}
      <Modal open={add} onClose={() => setAdd(false)} title="Add a certificate">
        <form onSubmit={addCert} className="space-y-4">
          <Field label="Certificate title"><input className="input" value={nc.title} onChange={(e) => setNc({ ...nc, title: e.target.value })} placeholder="For example Python Course Completion" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type"><select className="input" value={nc.kind} onChange={(e) => setNc({ ...nc, kind: e.target.value })}>{['Course certificate', 'Internship certificate', 'Workshop certificate', 'Marksheet', 'Award', 'Other'].map((k) => <option key={k}>{k}</option>)}</select></Field>
            <Field label="Issued by"><input className="input" value={nc.issuer} onChange={(e) => setNc({ ...nc, issuer: e.target.value })} placeholder="Organisation name" /></Field>
          </div>
          <FileDrop label="Certificate file" hint="PNG, JPG or PDF, up to 5 MB" file={nc.file} onFile={(file) => setNc({ ...nc, file })} />
          <Button loading={saving} disabled={!nc.file} className="w-full">Upload for verification</Button>
        </form>
      </Modal>
      {!certs ? <Skeleton /> : !certs.length ? <Card className="p-2"><Empty icon={Award} title="No signed certificates yet">Certificates appear here once your college issues or verifies them.</Empty></Card> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2">
          {certs.map((c) => (
            <motion.div key={c.id} variants={rise} whileHover={{ y: -4, rotate: -0.4 }} className="card relative overflow-hidden p-6">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-50" />
              <div className="relative">
                <Badge tone="ok" icon={ShieldCheck}>Digitally signed</Badge>
                <h3 className="mt-3 text-xl font-semibold">{c.title}</h3>
                <div className="mt-1 text-sm text-muted">{c.kind} · issued {c.issued_on}</div>
                <div className="mt-1 text-sm text-muted">By {c.issued_by}, {c.college}</div>
                <div className="mt-1 font-mono text-xs text-muted">{c.id}</div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="soft" onClick={() => setQr(c)}><QrCode size={16} />Show QR</Button>
                  <Link to={`/verify/${c.id}`} target="_blank" className="btn-ghost"><ExternalLink size={16} />Open verify page</Link>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      <Modal open={!!qr} onClose={() => setQr(null)} title={qr?.title || ''}>
        {qr && <div className="text-center">
          <motion.img initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            src={`/api/public/qr/${qr.id}.svg?origin=${encodeURIComponent(window.location.origin)}`} alt={`QR code for certificate ${qr.id}`} className="mx-auto h-56 w-56 rounded-2xl bg-[#fff] p-2" />
          <p className="mt-3 text-sm text-muted">Anyone who scans this sees who signed the certificate and whether it was changed.</p>
          <p className="mt-1 font-mono text-xs text-muted">{window.location.origin}/verify/{qr.id}</p>
        </div>}
      </Modal>
    </>
  )
}

function Shared() {
  const { user } = useAuth()
  const [shares] = useLoad('/student/shares')
  return (
    <>
      <PageHead title="Shared data" sub="Every time your placement cell sends your details to a recruiter, it is recorded here.">
        <Badge tone={user.consent ? 'ok' : 'warn'}>{user.consent ? 'Sharing with verified recruiters is on' : 'Sharing is switched off'}</Badge>
      </PageHead>
      {!shares ? <Skeleton /> : !shares.length ? <Card className="p-2"><Empty icon={Share2} title="Nothing shared yet">When your placement cell sends your details to a recruiter, you will see exactly what was sent.</Empty></Card> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {shares.map((s, i) => (
            <motion.div key={i} variants={rise} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="font-semibold text-navy">{s.company}</div><div className="text-sm text-muted">For: {s.purpose}</div></div>
                <span className="text-sm text-muted">{s.date}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{s.fields.map((f) => <Badge key={f}>{f}</Badge>)}</div>
              {s.notices?.length > 0 && <div className="mt-4 space-y-2"><div className="text-sm font-medium text-navy">Announcements from your placement cell</div>{s.notices.map((n) => <Notice key={n.id} n={n} />)}</div>}
            </motion.div>
          ))}
        </motion.div>
      )}
      <p className="mt-5 text-sm text-muted">You can switch sharing on or off in <Link className="font-semibold text-brand-600" to="/app/profile">Profile settings</Link>.</p>
    </>
  )
}
