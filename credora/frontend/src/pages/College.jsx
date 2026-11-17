import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Megaphone, Award, BadgeCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ExternalLink, Eye, FileText, FileUp, Inbox, Plus, Search, Send, ShieldCheck, Upload, UserPlus, Users, X, XCircle } from 'lucide-react'
import { api, download, useAuth, useLoad } from '../api.jsx'
import { Badge, Button, Card, Empty, Field, Modal, Notice, PageHead, Skeleton, Stat, ease, rise, stagger, useToast } from '../ui.jsx'

export default function College({ tab }) {
  return { overview: <Overview />, students: <Students />, approvals: <Approvals />, certificates: <Certificates />, placement: <Placement /> }[tab]
}

function Bar({ value, total, color = 'bg-brand-500' }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-line"><motion.div className={`h-full ${color}`} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} /></div>
      <span className="w-14 text-right tabular-nums">{value.toLocaleString('en-IN')}</span>
    </div>
  )
}

function Overview() {
  const { user } = useAuth()
  const [batch, setBatch] = useState('')
  const [ov] = useLoad(`/college/overview?batch=${encodeURIComponent(batch)}`)
  if (!ov) return <Skeleton rows={5} />
  const sum = (k) => ov.departments.reduce((a, d) => a + d[k], 0)
  return (
    <>
      <PageHead title={ov.college.name} sub={`College code ${ov.college.code} · Signed in as ${user.name}, ${user.staff_role_name}`}>
        <label className="flex items-center gap-2 text-sm text-muted">Batch
          <select className="input h-10 w-36" value={ov.batch} onChange={(e) => setBatch(e.target.value)}>{ov.batches.map((b) => <option key={b}>{b}</option>)}</select>
        </label>
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Students in this batch" value={sum('total')} />
        <Stat icon={ShieldCheck} label="Identity verified on Credora" value={sum('claimed')} tone="leaf" delay={0.06} />
        <Stat icon={FileText} label="Résumés verified" value={sum('resumes')} tone="sun" delay={0.12} />
        <Stat icon={Inbox} label="Recruiter requests waiting" value={ov.open_requests} delay={0.18} />
      </div>
      <AnimatePresence>
        {(ov.pending_students > 0 || ov.pending_resumes > 0 || ov.pending_certs > 0) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-5 overflow-hidden">
            <Link to="/app/approvals" className="flex items-center gap-3 rounded-2xl bg-sun-50 p-4 text-sm text-ink">
              <AlertTriangle size={18} className="shrink-0 text-sun-600" />
              <span><b>Waiting for you:</b> {ov.pending_students} student confirmation(s), {ov.pending_resumes} résumé(s) and {ov.pending_certs} certificate(s) to verify.</span>
              <span className="ml-auto font-semibold text-brand-600">Open approvals</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold">Batch {ov.batch} by department</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">Department</th><th className="th text-right">Students</th><th className="th">Identity verified</th><th className="th">Résumés verified</th></tr></thead>
            <motion.tbody variants={stagger} initial="hidden" animate="show">
              {ov.departments.map((d) => (
                <motion.tr key={d.name} variants={rise} className={d.mine ? '' : 'opacity-60'}>
                  <td className="td font-medium text-navy">{d.name} {!d.mine && <Badge tone="mute">Not your department</Badge>}</td>
                  <td className="td text-right tabular-nums">{d.total.toLocaleString('en-IN')}</td>
                  <td className="td"><Bar value={d.claimed} total={d.total} color="bg-leaf-500" /></td>
                  <td className="td"><Bar value={d.resumes} total={d.total} color="bg-sun-500" /></td>
                </motion.tr>
              ))}
              {!ov.departments.length && <tr><td colSpan={4} className="td"><Empty icon={Users} title="No departments yet">Add departments and students from the Students page.</Empty></td></tr>}
            </motion.tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Students() {
  const toast = useToast()
  const { refresh } = useAuth()
  const [ov, reloadOv] = useLoad('/college/overview')
  const [batch, setBatch] = useState('')
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const b = batch || ov?.batch || ''
  const [data, reload] = useLoad(ov ? `/college/roster?batch=${encodeURIComponent(b)}&department=${encodeURIComponent(dept)}&q=${encodeURIComponent(q)}&page=${page}` : null)
  useEffect(() => { setPage(1) }, [b, dept, q])
  const after = () => { setModal(null); reload(); reloadOv(); refresh() }
  if (!ov) return <Skeleton rows={5} />
  return (
    <>
      <PageHead title="Students" sub="Add batches and departments, then your students one by one or by CSV.">
        <Button variant="ghost" onClick={() => setModal('batch')}><Plus size={16} />Batch</Button>
        <Button variant="ghost" onClick={() => setModal('dept')}><Plus size={16} />Department</Button>
        <Button variant="ghost" onClick={() => setModal('student')}><UserPlus size={16} />Add student</Button>
        <Button onClick={() => setModal('csv')}><Upload size={16} />Upload CSV</Button>
      </PageHead>
      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
          <select aria-label="Batch" className="input" value={b} onChange={(e) => setBatch(e.target.value)}>{ov.batches.map((x) => <option key={x}>{x}</option>)}</select>
          <select aria-label="Department" className="input" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All my departments</option>{ov.scope.map((x) => <option key={x}>{x}</option>)}</select>
          <span className="relative"><Search size={16} className="absolute left-3.5 top-3.5 text-muted" /><input aria-label="Search" className="input pl-10" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} /></span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Roll no</th><th className="th">Name</th><th className="th">Department</th><th className="th text-right">CGPA</th><th className="th">Identity</th><th className="th">Résumé</th></tr></thead>
            <tbody>
              {(data?.rows || []).map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }} className="hover:bg-brand-50/40">
                  <td className="td font-mono text-[13px]">{r.roll_no}</td><td className="td font-medium text-navy">{r.name}</td><td className="td text-muted">{r.department}</td>
                  <td className="td text-right tabular-nums">{r.cgpa ?? ''}</td>
                  <td className="td">{r.claimed ? <Badge tone="ok" icon={BadgeCheck}>Verified</Badge> : <Badge tone="mute">Not joined</Badge>}</td>
                  <td className="td"><Badge tone={{ verified: 'ok', pending: 'warn', rejected: 'bad', none: 'mute' }[r.resume_status]}>{{ verified: 'Verified', pending: 'To review', rejected: 'Sent back', none: 'None' }[r.resume_status]}</Badge></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {data && !data.rows.length && <Empty icon={Users} title="No students found">Add students or upload a CSV for this batch.</Empty>}
        </div>
        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.total.toLocaleString('en-IN')} students</span>
            <span className="flex items-center gap-2">
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost h-9 w-9 !px-0"><ChevronLeft size={16} /></button>
              Page {page} of {data.pages}
              <button aria-label="Next page" disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="btn-ghost h-9 w-9 !px-0"><ChevronRight size={16} /></button>
            </span>
          </div>
        )}
      </Card>
      <SimpleAdd open={modal === 'batch'} title="Add a batch" label="Batch years" placeholder="2024-2028" onClose={() => setModal(null)} onSave={(v) => api('/college/batches', { body: { label: v } }).then(() => { toast('Batch added'); after() })} />
      <SimpleAdd open={modal === 'dept'} title="Add a department" label="Department name" placeholder="For example Data Science" onClose={() => setModal(null)} onSave={(v) => api('/college/departments', { body: { name: v, mine: true } }).then(() => { toast('Department added'); after() })} />
      <AddStudent open={modal === 'student'} ov={ov} batch={b} onClose={() => setModal(null)} onDone={() => { toast('Student saved'); after() }} />
      <CsvUpload open={modal === 'csv'} ov={ov} batch={b} onClose={() => setModal(null)} onDone={(r) => { toast(`${r.added} students saved${r.skipped ? `, ${r.skipped} skipped` : ''}`); after() }} />
    </>
  )
}

function SimpleAdd({ open, title, label, placeholder, onClose, onSave }) {
  const toast = useToast()
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(v); setV('') } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) } }
  return <Modal open={open} onClose={onClose} title={title}><form onSubmit={go} className="space-y-4"><Field label={label}><input className="input" autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} required /></Field><Button loading={busy} className="w-full">Save</Button></form></Modal>
}

function AddStudent({ open, ov, batch, onClose, onDone }) {
  const toast = useToast()
  const blank = { roll_no: '', name: '', department: ov.scope[0] || '', email: '', phone: '', cgpa: '', dob: '', category: '', address: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const go = async (e) => { e.preventDefault(); setBusy(true); try { await api('/college/roster', { body: { ...f, batch } }); setF(blank); onDone() } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title={`Add a student to batch ${batch}`}>
      <form onSubmit={go} className="grid gap-4 sm:grid-cols-2">
        <Field label="Roll number"><input className="input uppercase" value={f.roll_no} onChange={set('roll_no')} required /></Field>
        <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Department" className="sm:col-span-2"><select className="input" value={f.department} onChange={set('department')}>{ov.scope.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="College email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Mobile number"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="CGPA"><input className="input" inputMode="decimal" value={f.cgpa} onChange={set('cgpa')} /></Field>
        <Field label="Date of birth"><input className="input" placeholder="DD/MM/YYYY" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Category"><input className="input" value={f.category} onChange={set('category')} /></Field>
        <Field label="Home address"><input className="input" value={f.address} onChange={set('address')} /></Field>
        <Button loading={busy} className="sm:col-span-2">Save student</Button>
      </form>
    </Modal>
  )
}

function CsvUpload({ open, ov, batch, onClose, onDone }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); try { const r = await api('/college/roster/upload', { form: { batch, file } }); setFile(null); onDone(r) } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) } }
  return (
    <Modal open={open} onClose={onClose} title={`Upload students for batch ${batch}`}>
      <p className="text-sm text-muted">Upload a CSV or Excel (.xlsx) file. The first row names the columns. It needs a roll number, a name and a department; email, phone, CGPA, date of birth, category and address are optional. <a className="font-semibold text-brand-600" href="/api/public/roster-template.csv">Download a template</a>.</p>
      <label className={`mt-4 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 ${file ? 'border-leaf-500 bg-leaf-50' : 'border-line hover:border-brand-400'}`}>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">{file ? <Check size={22} /> : <FileUp size={22} />}</span>
        <span><span className="block font-semibold text-navy">{file ? file.name : 'Choose a CSV or Excel file'}</span><span className="text-sm text-muted">Students already on the roster are updated, not duplicated.</span></span>
        <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
      {ov.scope.length < ov.departments.length && <p className="mt-3 text-xs text-muted">Rows for departments outside your own are skipped.</p>}
      <Button loading={busy} disabled={!file} onClick={go} className="mt-4 w-full"><Upload size={16} />Upload</Button>
    </Modal>
  )
}

function Approvals() {
  const toast = useToast()
  const [data, reload] = useLoad('/college/pending')
  const act = async (path, msg) => { try { await api(path, { method: 'POST' }); toast(msg); reload() } catch (e) { toast(e.message, 'bad') } }
  if (!data) return <Skeleton rows={4} />
  const Row = ({ title, sub, children }) => (
    <motion.li layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40, height: 0 }} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-0">
      <div><div className="font-semibold text-navy">{title}</div><div className="text-sm text-muted">{sub}</div></div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </motion.li>
  )
  return (
    <>
      <PageHead title="Approvals" sub="Confirm students who are not on the roster yet, and verify the résumés and certificates students upload." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-2">
          <h2 className="px-4 pt-3 text-lg font-semibold">Students waiting for confirmation</h2>
          {!data.students.length ? <Empty icon={ClipboardCheck} title="All clear">Students whose roll number is not on the roster appear here.</Empty> : (
            <ul><AnimatePresence>{data.students.map((s) => (
              <Row key={s.id} title={`${s.name} · ${s.roll_no}`} sub={`${s.department} · batch ${s.batch} · ${s.email}`}>
                <Button variant="leaf" onClick={() => act(`/college/students/${s.id}/approve`, `${s.name} confirmed and added to the roster`)}><Check size={16} />Confirm</Button>
                <Button variant="danger" onClick={() => act(`/college/students/${s.id}/reject`, 'Request rejected')}><X size={16} />Reject</Button>
              </Row>
            ))}</AnimatePresence></ul>
          )}
        </Card>
        <Card className="p-2" delay={0.08}>
          <h2 className="px-4 pt-3 text-lg font-semibold">Résumés to verify</h2>
          {!data.resumes.length ? <Empty icon={FileText} title="Nothing to review">Résumés uploaded by students in your departments appear here.</Empty> : (
            <ul><AnimatePresence>{data.resumes.map((s) => (
              <Row key={s.id} title={`${s.name} · ${s.roll_no}`} sub={s.department}>
                <Button variant="ghost" onClick={() => download(`/college/resumes/${s.id}/file`, { open: true }).catch((e) => toast(e.message, 'bad'))}><Eye size={16} />View</Button>
                <Button variant="leaf" onClick={() => act(`/college/resumes/${s.id}/approve`, 'Résumé verified')}><Check size={16} />Verify</Button>
                <Button variant="danger" onClick={() => act(`/college/resumes/${s.id}/reject`, 'Résumé sent back')}><X size={16} />Send back</Button>
              </Row>
            ))}</AnimatePresence></ul>
          )}
        </Card>
        <Card className="p-2 lg:col-span-2" delay={0.12}>
          <h2 className="px-4 pt-3 text-lg font-semibold">Certificates uploaded by students</h2>
          {!data.certificates.length ? <Empty icon={Award} title="Nothing to verify">When a student adds a certificate to their wallet, it appears here for you to check and sign.</Empty> : (
            <ul><AnimatePresence>{data.certificates.map((c) => (
              <Row key={c.id} title={c.title} sub={`${c.name} · ${c.roll_no} · ${c.department} · ${c.kind}${c.issuer ? ` · issued by ${c.issuer}` : ''}`}>
                <Button variant="ghost" onClick={() => download(`/college/cert-uploads/${c.id}/file`, { open: true }).catch((e) => toast(e.message, 'bad'))}><Eye size={16} />View</Button>
                <Button variant="leaf" onClick={() => act(`/college/cert-uploads/${c.id}/approve`, 'Certificate verified and signed')}><Check size={16} />Verify and sign</Button>
                <Button variant="danger" onClick={() => act(`/college/cert-uploads/${c.id}/reject`, 'Certificate sent back')}><X size={16} />Send back</Button>
              </Row>
            ))}</AnimatePresence></ul>
          )}
        </Card>
      </div>
    </>
  )
}

function OpeningInfo({ r }) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2"><Badge>{r.kind === 'job' ? 'Job' : 'Internship'}</Badge>{r.amount && <span className="text-sm font-semibold text-navy">{r.amount}</span>}{r.deadline && <span className="text-sm text-muted">· closes {r.deadline}</span>}{r.min_cgpa != null && <span className="text-sm text-muted">· minimum CGPA {r.min_cgpa}</span>}</div>
      {r.description && <p className="mt-2 text-sm text-ink">{r.description}</p>}
    </div>
  )
}

function Certificates() {
  const toast = useToast()
  const { user } = useAuth()
  const [ov] = useLoad('/college/overview')
  const [certs, reload] = useLoad('/college/certificates')
  const [q, setQ] = useState('')
  const [found] = useLoad(q.trim().length >= 2 ? `/college/roster?q=${encodeURIComponent(q.trim())}` : null)
  const [pick, setPick] = useState(null)
  const [f, setF] = useState({ title: '', kind: 'Certificate', details: '' })
  const [busy, setBusy] = useState(false)
  const issue = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await api('/college/certificates', { body: { ...f, roster_id: pick.id } }); toast(`Certificate ${r.id} signed and issued`); setPick(null); setQ(''); setF({ title: '', kind: 'Certificate', details: '' }); reload() }
    catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  if (!ov) return <Skeleton rows={4} />
  return (
    <>
      <PageHead title="Certificates" sub="Each certificate is signed with the college's private key. Anyone can confirm it with the QR code." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">Issue a certificate</h2>
          {!ov.can_certify ? <p className="mt-3 rounded-xl bg-sun-50 p-3 text-sm text-ink">Only a principal, head of department or college placement officer can issue certificates. Your role is {user.staff_role_name}.</p> : (
            <form onSubmit={issue} className="mt-4 space-y-4">
              {pick ? (
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3">
                  <div><div className="font-semibold text-navy">{pick.name}</div><div className="text-sm text-muted">{pick.roll_no} · {pick.department}</div></div>
                  <button type="button" aria-label="Choose a different student" onClick={() => setPick(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface"><X size={16} /></button>
                </motion.div>
              ) : (
                <Field label="Find the student">
                  <input className="input" placeholder="Type a name or roll number" value={q} onChange={(e) => setQ(e.target.value)} />
                  {found?.rows?.length > 0 && <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line">{found.rows.slice(0, 8).map((r) => (
                    <li key={r.id}><button type="button" onClick={() => setPick(r)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-brand-50"><span className="font-medium text-navy">{r.name}</span><span className="font-mono text-xs text-muted">{r.roll_no}</span></button></li>
                  ))}</ul>}
                </Field>
              )}
              <Field label="Certificate title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="For example Internship Completion" required /></Field>
              <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['Certificate', 'Marksheet', 'Workshop certificate', 'Bonafide certificate', 'Internship certificate'].map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="Details (optional)"><input className="input" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></Field>
              <Button loading={busy} disabled={!pick} className="w-full"><Award size={16} />Sign and issue</Button>
            </form>
          )}
        </Card>
        <Card className="p-2" delay={0.08}>
          <h2 className="px-4 pt-3 text-lg font-semibold">Issued certificates</h2>
          {!certs ? <div className="p-4"><Skeleton /></div> : !certs.length ? <Empty icon={Award} title="None issued yet" /> : (
            <motion.ul variants={stagger} initial="hidden" animate="show">
              {certs.map((c) => (
                <motion.li key={c.id} variants={rise} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-0">
                  <div><div className="font-semibold text-navy">{c.title}</div><div className="text-sm text-muted">{c.student_name} · {c.roll_no} · {c.issued_on}</div><div className="font-mono text-xs text-muted">{c.id}</div></div>
                  <Link to={`/verify/${c.id}`} target="_blank" className="btn-ghost h-10"><ExternalLink size={15} />Verify page</Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Card>
      </div>
    </>
  )
}

function Placement() {
  const [reqs, reload] = useLoad('/college/requests')
  const [open, setOpen] = useState(null)
  const toast = useToast()
  const [ann, setAnn] = useState(null)
  const [note, setNote] = useState({ body: '', event_date: '' })
  const [posting, setPosting] = useState(false)
  const startAnn = (r) => { const from = r.notices.find((n) => n.side === 'recruiter'); setNote({ body: from ? from.body : '', event_date: from ? from.event_date : '' }); setAnn(r) }
  const announce = async (e) => {
    e.preventDefault(); setPosting(true)
    try { const res = await api(`/college/requests/${ann.id}/announce`, { body: note }); toast(res.message); setAnn(null); reload() }
    catch (err) { toast(err.message, 'bad') } finally { setPosting(false) }
  }
  if (!reqs) return <Skeleton rows={4} />
  const cur = reqs.find((r) => r.id === open)
  return (
    <>
      <PageHead title="Placement cell" sub="Recruiters ask for specific details. You choose the students, Credora checks the list, and only then is it sent." />
      <AnimatePresence mode="wait">
        {cur ? <Composer key={cur.id} req={cur} onBack={() => { setOpen(null); reload() }} /> : (
          <motion.div key="list" variants={stagger} initial="hidden" animate="show" className="space-y-4">
            {!reqs.length && <Card className="p-2"><Empty icon={Inbox} title="No requests yet">When a verified recruiter asks for student details, the request appears here.</Empty></Card>}
            {reqs.map((r) => (
              <motion.div key={r.id} variants={rise} whileHover={{ y: -3 }} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-display text-lg font-semibold text-navy">{r.company}</span><Badge tone="ok" icon={BadgeCheck}>Verified company</Badge>
                      <Badge tone={{ open: 'warn', fulfilled: 'ok', declined: 'mute' }[r.status]}>{{ open: 'Waiting for you', fulfilled: 'Sent', declined: 'Declined' }[r.status]}</Badge></div>
                    <div className="mt-1 text-sm text-muted">{r.purpose} · {r.department}, batch {r.batch} · asked by {r.recruiter} on {r.date}</div>
                    <OpeningInfo r={r} />
                    <div className="mt-3 text-sm font-medium text-navy">Student details requested</div>
                    <div className="mt-3 flex flex-wrap gap-2">{r.fields.map((f) => <Badge key={f}>{f}</Badge>)}</div>
                  </div>
                  {r.status === 'open' && <Button onClick={() => setOpen(r.id)}><Send size={16} />Prepare and send</Button>}
                  {r.status === 'fulfilled' && <Button onClick={() => startAnn(r)}><Megaphone size={16} />Announce to students</Button>}
                </div>
                {r.status === 'fulfilled' && (
                  <div className="mt-4 rounded-2xl bg-brand-50/60 p-4">
                    <div className="flex items-center gap-2 font-display font-semibold text-navy"><Megaphone size={18} className="text-brand-600" />What happens next</div>
                    {!r.notices.length ? <p className="mt-1 text-sm text-muted">Details for {r.students} students were sent. {r.company} has not announced the rounds yet. You can still post your own announcement to these students.</p> : (
                      <div className="mt-3 space-y-2">{r.notices.map((n) => <Notice key={n.id} n={n} label={n.side === 'recruiter' ? `From ${n.org}` : `Announced to ${r.students} students`} />)}</div>
                    )}
                    {r.notices.some((n) => n.side === 'recruiter') && !r.notices.some((n) => n.side === 'college') && <p className="mt-3 flex items-center gap-2 text-sm text-sun-600"><AlertTriangle size={15} />Your students have not been told yet. Use “Announce to students”.</p>}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <Modal open={!!ann} onClose={() => setAnn(null)} title={ann ? `Announce to ${ann.students} students` : ''}>
        {ann && (
          <form onSubmit={announce} className="space-y-4">
            <p className="text-sm text-muted">This goes to the students whose details you sent to {ann.company} for {ann.purpose}. They see it on their dashboard.{ann.notices.some((n) => n.side === 'recruiter') ? ' The recruiter’s message is filled in for you; edit it or add your own instructions.' : ''}</p>
            <Field label="Announcement"><textarea className="input h-40 py-2.5" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} placeholder={'For example:\nRound 1: Online aptitude test on 24 November, 10 am, Lab 3\nBring your college ID and a printed résumé.'} required /></Field>
            <Field label="Date of the first round"><input className="input max-w-[220px]" type="date" value={note.event_date} onChange={(e) => setNote({ ...note, event_date: e.target.value })} /></Field>
            <Button loading={posting} className="w-full"><Megaphone size={16} />Announce to students</Button>
          </form>
        )}
      </Modal>
    </>
  )
}

function Composer({ req, onBack }) {
  const toast = useToast()
  const { meta } = useAuth()
  const [cands] = useLoad(`/college/requests/${req.id}/candidates`)
  const [sel, setSel] = useState([])
  const [fields, setFields] = useState(req.fields)
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const ready = useMemo(() => (cands || []).filter((c) => c.ready), [cands])
  useEffect(() => { if (cands) setSel(ready.map((c) => c.id)) }, [cands, ready])
  useEffect(() => {
    if (!cands) return
    const t = setTimeout(() => api(`/college/requests/${req.id}/precheck`, { body: { roster_ids: sel, fields } }).then(setCheck).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [sel, fields, cands, req.id])
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const send = async () => {
    setBusy(true)
    try { const r = await api(`/college/requests/${req.id}/send`, { body: { roster_ids: sel, fields } }); toast(r.message); setSent(true) } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  const decline = async () => { try { await api(`/college/requests/${req.id}/decline`, { method: 'POST' }); toast('Request declined', 'info'); onBack() } catch (e) { toast(e.message, 'bad') } }
  const tone = { ok: ['bg-leaf-50', 'text-leaf-600', CheckCircle2], warn: ['bg-sun-50', 'text-sun-600', AlertTriangle], bad: ['bg-rose-50', 'text-rose-600', XCircle] }

  if (sent) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card grid place-items-center p-12 text-center">
      <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="grid h-20 w-20 place-items-center rounded-full bg-leaf-500 text-white"><Send size={34} /></motion.span>
      <h2 className="mt-5 text-2xl font-bold">Sent to {req.company}</h2>
      <p className="mt-2 max-w-md text-muted">{fields.length} details for {sel.length} students. The share is recorded in each student's account and in the audit log.</p>
      <Button variant="ghost" className="mt-6" onClick={onBack}>Back to requests</Button>
    </motion.div>
  )
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3, ease }} className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"><ChevronLeft size={16} />All requests</button>
      <div className="card bg-brand-50/60 p-5">
        <div className="flex flex-wrap items-center gap-2"><span className="font-display text-lg font-semibold text-navy">{req.company}</span><Badge tone="ok" icon={BadgeCheck}>Verified company</Badge></div>
        <div className="mt-1 text-sm text-muted">{req.purpose} · {req.department}, batch {req.batch}</div>
        <OpeningInfo r={req} />
        <div className="mt-3 text-sm font-medium text-navy">The recruiter asked for these {req.fields.length} details:</div>
        <div className="mt-2 flex flex-wrap gap-2">{req.fields.map((f) => <Badge key={f}>{f}</Badge>)}</div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">1. Choose students <span className="text-sm font-normal text-muted">({sel.length} selected)</span></h2>
            <span className="flex gap-2"><button className="text-sm font-semibold text-brand-600" onClick={() => setSel(ready.map((c) => c.id))}>Select all ready</button><button className="text-sm font-semibold text-muted" onClick={() => setSel([])}>Clear</button></span>
          </div>
          {!cands ? <Skeleton /> : (
            <div className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border border-line">
              {cands.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 text-sm last:border-0 ${sel.includes(c.id) ? 'bg-brand-50/60' : ''}`}>
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={sel.includes(c.id)} onChange={() => toggle(sel, setSel, c.id)} />
                  <span className="w-20 font-mono text-xs text-muted">{c.roll_no}</span>
                  <span className="flex-1 font-medium text-navy">{c.name}</span>
                  {c.ready ? <Badge tone="ok">Ready</Badge> : !c.claimed ? <Badge tone="mute">Not verified</Badge> : !c.consent ? <Badge tone="warn">Sharing off</Badge> : <Badge tone="warn">Missing {c.missing[0]}</Badge>}
                </label>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-5">
          <Card className="p-5" delay={0.05}>
            <h2 className="text-lg font-semibold">2. Details you are sending</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-3">
              {(meta?.share_fields || []).map((f) => (
                <label key={f} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={fields.includes(f)} onChange={() => toggle(fields, setFields, f)} />{f}
                </label>
              ))}
            </div>
          </Card>
          <Card className="p-5" delay={0.1}>
            <h2 className="text-lg font-semibold">3. Credora check before sending</h2>
            <ul className="mt-3 space-y-2" aria-live="polite">
              <AnimatePresence initial={false}>
                {(check?.issues || []).map((i) => {
                  const [bg, fg, I] = tone[i.level]
                  return (
                    <motion.li key={i.tag + i.text} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`flex items-start gap-2.5 rounded-xl p-3 text-sm ${bg}`}>
                      <I size={17} className={`mt-0.5 shrink-0 ${fg}`} /><span><b className={fg}>{i.tag}.</b> {i.text}</span>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
            <Button variant={check?.ready ? 'leaf' : 'primary'} loading={busy} disabled={!check?.ready} onClick={send} className="mt-4 w-full"><Send size={16} />Send to recruiter</Button>
            <p className="mt-2 text-xs text-muted">{check && !check.can_share ? 'Only a placement officer or the principal can send student details.' : check?.ready ? 'Ready to send. Each student will see what was shared and with whom.' : 'Sending is blocked until every check passes.'}</p>
            <button onClick={decline} className="mt-3 text-sm font-semibold text-rose-600">Decline this request</button>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
