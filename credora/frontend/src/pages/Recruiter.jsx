import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Megaphone, Briefcase, Building2, Download, FileArchive, FileSpreadsheet, FileText, Inbox, Plus, Send, Table2, Users } from 'lucide-react'
import { api, download, useAuth, useLoad } from '../api.jsx'
import { Badge, Button, Card, Empty, Field, Modal, Notice, PageHead, Skeleton, Stat, fmtDate, rise, stagger, useToast } from '../ui.jsx'
import { CertCheck } from './VerifyCert.jsx'

export default function Recruiter({ tab }) {
  return { overview: <Overview />, applicants: <Applicants />, details: <Details />, verify: <><PageHead title="Verify a certificate" sub="Enter the certificate ID printed under its QR code." /><CertCheck /></> }[tab]
}

function Overview() {
  const { user } = useAuth()
  const toast = useToast()
  const [ov, reload] = useLoad('/recruiter/overview')
  const [open, setOpen] = useState(false)
  const blank = { kind: 'internship', title: '', amount: '', deadline: '', description: '', min_cgpa: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const post = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api('/recruiter/openings', { body: f }); toast('Opening posted'); setOpen(false); setF(blank); reload() } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  if (!ov) return <Skeleton rows={5} />
  const co = user.company
  return (
    <>
      <PageHead title="Recruiter workspace" sub={`Signed in as ${user.name}, ${user.designation}`}><Button onClick={() => setOpen(true)}><Plus size={16} />Post an opening</Button></PageHead>
      <Card className="relative mb-5 overflow-hidden p-6">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sun-50" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sun-500 text-white"><Building2 size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{co.name}</h2><Badge tone="ok" icon={BadgeCheck}>Verified company</Badge></div>
            <div className="mt-1 text-sm text-muted">Registration {co.reg_no} · Email domain {co.domain} · No fees charged to students</div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Briefcase} label="Openings posted" value={ov.openings.length} tone="sun" />
        <Stat icon={Users} label="Applicants" value={ov.applicants} delay={0.06} />
        <Stat icon={Send} label="Detail requests sent" value={ov.requests} delay={0.12} />
        <Stat icon={Inbox} label="Data sets received" value={ov.shares} tone="leaf" delay={0.18} />
      </div>
      <h2 className="mb-3 mt-7 text-lg font-semibold">Your openings</h2>
      {!ov.openings.length ? <Card className="p-2"><Empty icon={Briefcase} title="No openings yet">Post your first internship or job.</Empty></Card> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
          {ov.openings.map((o) => (
            <motion.div key={o.id} variants={rise} whileHover={{ y: -4 }} className="card p-5">
              <div className="flex items-start justify-between gap-3"><Badge>{o.kind === 'job' ? 'Job' : 'Internship'}</Badge><span className="font-display text-2xl font-bold text-navy">{o.applicants}<span className="ml-1 text-xs font-medium text-muted">applicants</span></span></div>
              <h3 className="mt-2 text-lg font-semibold">{o.title}</h3>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              <div className="mt-3 text-sm"><b className="text-navy">{o.amount}</b>{o.deadline && <span className="text-muted"> · closes {fmtDate(o.deadline)}</span>}</div>
            </motion.div>
          ))}
        </motion.div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Post an opening">
        <form onSubmit={post} className="grid gap-4 sm:grid-cols-2">
          <Field label="Type"><select className="input" value={f.kind} onChange={set('kind')}><option value="internship">Internship</option><option value="job">Job</option></select></Field>
          <Field label="Closing date"><input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></Field>
          <Field label="Title" className="sm:col-span-2"><input className="input" value={f.title} onChange={set('title')} required /></Field>
          <Field label="Stipend or salary"><input className="input" value={f.amount} onChange={set('amount')} placeholder="For example ₹20,000 per month" /></Field>
          <Field label="Minimum CGPA (optional)"><input className="input" inputMode="decimal" value={f.min_cgpa} onChange={set('min_cgpa')} /></Field>
          <Field label="Description" className="sm:col-span-2" hint="Openings that ask students for any fee or deposit are blocked."><textarea className="input h-24 py-2.5" value={f.description} onChange={set('description')} /></Field>
          <Button loading={busy} className="sm:col-span-2">Post opening</Button>
        </form>
      </Modal>
    </>
  )
}

function Applicants() {
  const toast = useToast()
  const [ov] = useLoad('/recruiter/overview')
  const [oid, setOid] = useState(null)
  useEffect(() => { if (ov?.openings.length && !oid) setOid([...ov.openings].sort((a, b) => b.applicants - a.applicants)[0].id) }, [ov, oid])
  const [data, reload] = useLoad(oid ? `/recruiter/openings/${oid}/applicants` : null)
  const setStatus = async (a, status) => { try { await api(`/recruiter/applications/${a.application_id}/status`, { body: { status } }); reload() } catch (e) { toast(e.message, 'bad') } }
  if (!ov) return <Skeleton rows={4} />
  return (
    <>
      <PageHead title="Applicants" sub="You see only students who applied to your openings. Their identity and résumé are verified by their college.">
        {ov.openings.length > 0 && <select aria-label="Opening" className="input h-10 w-64" value={oid || ''} onChange={(e) => setOid(Number(e.target.value))}>{ov.openings.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>}
      </PageHead>
      <Card className="p-5">
        {!ov.openings.length ? <Empty icon={Briefcase} title="Post an opening first" /> : !data ? <Skeleton /> : !data.applicants.length ? <Empty icon={Users} title="No applicants yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr><th className="th">Student</th><th className="th">College and course</th><th className="th text-right">CGPA</th><th className="th">Résumé</th><th className="th text-right">Signed certificates</th><th className="th">Status</th><th className="th"><span className="sr-only">Download</span></th></tr></thead>
              <motion.tbody variants={stagger} initial="hidden" animate="show">
                {data.applicants.map((a) => (
                  <motion.tr key={a.application_id} variants={rise} className="hover:bg-brand-50/40">
                    <td className="td font-medium text-navy">{a.name}</td>
                    <td className="td text-muted">{a.college} · {a.department}</td>
                    <td className="td text-right tabular-nums">{a.cgpa ?? ''}</td>
                    <td className="td">{a.resume_status === 'verified' ? <Badge tone="ok" icon={BadgeCheck}>Verified by college</Badge> : <Badge tone="warn">Not verified</Badge>}</td>
                    <td className="td text-right tabular-nums">{a.certificates}</td>
                    <td className="td"><select aria-label={`Status for ${a.name}`} className="input h-9 w-36 text-sm" value={a.status} onChange={(e) => setStatus(a, e.target.value)}>{['Submitted', 'Under review', 'Shortlisted', 'Selected', 'Not selected'].map((s) => <option key={s} disabled={s === 'Submitted'}>{s}</option>)}</select></td>
                    <td className="td text-right"><Button variant="ghost" className="h-9" disabled={a.resume_status !== 'verified'} onClick={() => download(`/recruiter/applications/${a.application_id}/resume`).catch((e) => toast(e.message, 'bad'))}><Download size={15} />Résumé</Button></td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

const FORMATS = [['pdf', 'PDF', FileText], ['xlsx', 'Excel', FileSpreadsheet], ['docx', 'Word', FileText], ['csv', 'CSV', Table2]]

function Details() {
  const toast = useToast()
  const { meta } = useAuth()
  const [colleges] = useLoad('/recruiter/colleges')
  const [reqs, reload] = useLoad('/recruiter/requests')
  const [f, setF] = useState({ college_id: '', department: '', batch: '', kind: 'internship', purpose: '', amount: '', deadline: '', min_cgpa: '', description: '', fields: ['Full name', 'Roll number', 'Department', 'CGPA', 'College email', 'Résumé'] })
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null)
  const [share, reloadShare] = useLoad(view ? `/recruiter/shares/${view}` : null)
  const [note, setNote] = useState({ body: '', event_date: '' })
  const [posting, setPosting] = useState(false)
  const announce = async (e) => {
    e.preventDefault(); setPosting(true)
    try { const r = await api(`/recruiter/shares/${view}/announce`, { body: note }); toast(r.message); setNote({ body: '', event_date: '' }); reloadShare(); reload() }
    catch (err) { toast(err.message, 'bad') } finally { setPosting(false) }
  }
  const col = colleges?.find((c) => String(c.id) === String(f.college_id))
  useEffect(() => { if (colleges?.length && !f.college_id) setF((x) => ({ ...x, college_id: colleges[0].id, department: colleges[0].departments[0] || '', batch: colleges[0].batches.at(-1) || '' })) }, [colleges, f.college_id])
  const send = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await api('/recruiter/requests', { body: { ...f, college_id: Number(f.college_id) } }); toast(r.message); setF({ ...f, purpose: '', amount: '', deadline: '', min_cgpa: '', description: '' }); reload() } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  const dl = (fmt) => download(`/recruiter/shares/${view}/download?format=${fmt}`).then(() => toast(`Downloaded as ${fmt.toUpperCase()}`)).catch((e) => toast(e.message, 'bad'))
  const tone = { open: ['warn', 'Waiting for the college'], fulfilled: ['ok', 'Received'], declined: ['mute', 'Declined'] }
  return (
    <>
      <PageHead title="Student details" sub="Ask a placement cell for exactly the details you need. You receive those details and nothing more." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">Send an opening to a college</h2>
          <p className="mt-1 text-sm text-muted">Describe the opening and tick the student details you need. The placement cell replies with matching students.</p>
          {!colleges ? <Skeleton /> : (
            <form onSubmit={send} className="mt-4 space-y-4">
              <Field label="College"><select className="input" value={f.college_id} onChange={(e) => { const c = colleges.find((x) => String(x.id) === e.target.value); setF({ ...f, college_id: e.target.value, department: c.departments[0] || '', batch: c.batches.at(-1) || '' }) }}>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{(col?.departments || []).map((d) => <option key={d}>{d}</option>)}</select></Field>
                <Field label="Batch"><select className="input" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}>{(col?.batches || []).map((d) => <option key={d}>{d}</option>)}</select></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="internship">Internship</option><option value="job">Job</option></select></Field>
                <Field label="Closing date"><input className="input" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
              </div>
              <Field label="Opening title"><input className="input" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="For example Graduate Engineer Trainee" required /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Stipend or salary"><input className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="For example ₹5 LPA" /></Field>
                <Field label="Minimum CGPA (optional)"><input className="input" inputMode="decimal" value={f.min_cgpa} onChange={(e) => setF({ ...f, min_cgpa: e.target.value })} /></Field>
              </div>
              <Field label="Description" hint="The placement cell reads this before choosing students. Openings that ask for any fee are blocked."><textarea className="input h-24 py-2.5" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required /></Field>
              <fieldset><legend className="label">Details you need</legend>
                <div className="grid grid-cols-2 gap-x-3">{(meta?.share_fields || []).map((x) => (
                  <label key={x} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.fields.includes(x)} onChange={() => setF({ ...f, fields: f.fields.includes(x) ? f.fields.filter((y) => y !== x) : [...f.fields, x] })} />{x}</label>
                ))}</div>
              </fieldset>
              <Button loading={busy} className="w-full"><Send size={16} />Send request</Button>
            </form>
          )}
        </Card>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
          {!reqs ? <Skeleton /> : !reqs.length ? <Card className="p-2"><Empty icon={Inbox} title="No requests yet" /></Card> : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              {reqs.map((r) => (
                <motion.div key={r.id} variants={rise} whileHover={{ y: -3 }} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="font-display font-semibold text-navy">{r.college}</div><div className="text-sm text-muted">{r.kind === 'job' ? 'Job' : 'Internship'}: {r.purpose} · {r.department}, batch {r.batch} · {r.date}</div></div>
                    <Badge tone={tone[r.status][0]}>{tone[r.status][1]}</Badge>
                  </div>
                  {(r.amount || r.description) && <p className="mt-2 text-sm text-ink">{r.amount && <b className="text-navy">{r.amount}. </b>}{r.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">{r.fields.map((x) => <Badge key={x}>{x}</Badge>)}</div>
                  {r.share_id && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-leaf-50 p-3"><span className="text-sm text-ink"><b className="text-leaf-600">{r.fields.length} of {r.fields.length}</b> requested details received for {r.students} students</span><Button variant="leaf" className="h-10" onClick={() => setView(r.share_id)}><Download size={15} />View, download and announce</Button></div>}
                  {r.share_id && (r.notices?.length ? <div className="mt-3 space-y-2"><div className="text-sm font-medium text-navy">Next steps you announced</div>{r.notices.slice(0, 1).map((n) => <Notice key={n.id} n={n} label="Sent to the placement cell" />)}</div>
                    : <p className="mt-3 flex items-center gap-2 text-sm text-sun-600"><Megaphone size={15} />Next: tell the placement cell the rounds and the first date.</p>)}
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
      <Modal wide open={!!view} onClose={() => setView(null)} title={share ? `${share.college}: ${share.purpose}` : 'Loading'}>
        {!share ? <Skeleton /> : <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-navy">Download as</span>
            {FORMATS.map(([id, label, I]) => <Button key={id} variant="ghost" className="h-10" onClick={() => dl(id)}><I size={15} />{label}</Button>)}
            {share.has_resumes && <Button variant="ghost" className="h-10" onClick={() => dl('zip')}><FileArchive size={15} />Full package (ZIP)</Button>}
          </div>
          <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 bg-surface"><tr>{share.fields.map((x) => <th key={x} className="th">{x}</th>)}</tr></thead>
              <tbody>{share.rows.map((row, i) => <tr key={i}>{share.fields.map((x) => <td key={x} className="td">{x === 'Résumé' && row[x] ? <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-brand-600" onClick={() => download(`/recruiter/shares/${view}/resume/${i}`, { open: true }).catch((e) => toast(e.message, 'bad'))}><FileText size={15} />Open résumé</button> : row[x]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">{share.has_resumes ? 'The PDF includes every résumé after the table, and the full package holds the details plus each résumé as its own file. ' : ''}Every download is logged, and the PDF carries your company name as a watermark.</p>
          <form onSubmit={announce} className="mt-5 rounded-2xl bg-brand-50/60 p-4">
            <div className="flex items-center gap-2 font-display font-semibold text-navy"><Megaphone size={18} className="text-brand-600" />Announce the next steps</div>
            <p className="mt-1 text-sm text-muted">Tell the placement cell what the rounds are and when the first one happens. They pass it on to these students.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
              <Field label="Announcement"><textarea className="input h-28 py-2.5" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} placeholder={'For example:\nRound 1: Online aptitude test (60 minutes)\nRound 2: Technical interview\nRound 3: HR interview'} required /></Field>
              <div className="space-y-3"><Field label="Date of the first round"><input className="input" type="date" value={note.event_date} onChange={(e) => setNote({ ...note, event_date: e.target.value })} /></Field>
                <Button loading={posting} className="w-full"><Send size={16} />Send to placement cell</Button></div>
            </div>
            {share.notices?.length > 0 && <div className="mt-4 space-y-2"><div className="text-sm font-medium text-navy">Already sent</div>{share.notices.map((n) => <Notice key={n.id} n={n} label="You" />)}</div>}
          </form>
        </>}
      </Modal>
    </>
  )
}
