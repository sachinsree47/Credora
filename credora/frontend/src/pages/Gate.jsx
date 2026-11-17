import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Building2, Check, Clock, Download, Info, Lock, LogOut, PartyPopper, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { api, useAuth } from '../api.jsx'
import { Badge, Button, Field, FileDrop, Logo, ThemeToggle, ease, useToast } from '../ui.jsx'

const HEAD = {
  student: ['One quick check, then you are in', 'Upload your college ID card. We match it with your college’s student list.'],
  college: ['Confirm your role to open the dashboard', 'Upload your staff ID. If your college is new here, name it and import your students.'],
  recruiter: ['Confirm your company to open the dashboard', 'Upload one document that shows you recruit for this company.'],
}

/** Looks a college code up as you type, so you know straight away whether it exists on Credora. */
export function useCollegeLookup(code) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    const c = (code || '').trim()
    if (!c) { setRes(null); return }
    const t = setTimeout(() => api(`/public/college/${encodeURIComponent(c)}`).then(setRes).catch(() => setRes(null)), 300)
    return () => clearTimeout(t)
  }, [code])
  return res
}

export default function Gate() {
  const { user, setUser, signOut, refresh, meta } = useAuth()
  const toast = useToast()
  const role = user.role
  const [result, setResult] = useState(user.status === 'unverified' ? null : user)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState({})
  const [f, setF] = useState({ name: user.name, college_code: user.college_code, roll_no: user.roll_no, college_name: user.college_name || '', batch: '2023-2027' })
  const [staffRole, setStaffRole] = useState('staff')
  const [depts, setDepts] = useState([])
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })) }
  const file = (k) => (x) => setFiles((p) => ({ ...p, [k]: x }))
  const lookup = useCollegeLookup(role === 'recruiter' ? '' : f.college_code)
  const newCollege = role === 'college' && !user.college
  const sensitive = staffRole !== 'staff'
  const whole = staffRole === 'cpo' || staffRole === 'principal'

  useEffect(() => {
    if (result?.status === 'verified') confetti({ particleCount: 150, spread: 85, origin: { y: 0.6 }, colors: ['#2456D6', '#F27A21', '#17965C'] })
  }, [result])

  const ready = role === 'student' ? files.id && f.name.trim() && f.college_code.trim() && f.roll_no.trim()
    : role === 'college' ? files.staff && (!sensitive || files.letter) && (!newCollege || f.college_name.trim().length >= 3)
      : files.doc
  const submit = async () => {
    const form = role === 'student' ? { college_id_card: files.id, name: f.name, college_code: f.college_code, roll_no: f.roll_no }
      : role === 'college' ? { staff_role: staffRole, depts: JSON.stringify(depts), college_name: f.college_name, batch: f.batch, staff_id: files.staff, letter: sensitive ? files.letter : undefined, students: files.students }
        : { document: files.doc }
    setBusy(true)
    try { const [r] = await Promise.all([api(`/verify/${role}`, { form }), new Promise((ok) => setTimeout(ok, 1400))]); setResult(r) }
    catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  const recheck = async () => { const u = await refresh(); if (u) { setResult(u); if (u.status === 'pending') toast('Still waiting for your college', 'info') } }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="blob -right-24 -top-24 h-80 w-80 bg-brand-200" />
      <div className="blob -left-24 bottom-0 h-72 w-72 bg-sun-50" style={{ animationDelay: '-6s' }} />
      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2"><ThemeToggle /><button onClick={signOut} className="btn-ghost"><LogOut size={16} />Sign out</button></div>
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-16">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4">
          <motion.span animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-lift"><Lock size={24} /></motion.span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{HEAD[role][0]}</h1>
            <p className="mt-1 text-muted">Hello {user.name.split(' ')[0]}. {HEAD[role][1]}</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {busy ? (
            <motion.section key="busy" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="card relative mt-7 overflow-hidden p-12 text-center">
              <motion.div className="absolute inset-x-0 h-24 bg-gradient-to-b from-brand-200/0 via-brand-200/70 to-brand-200/0" animate={{ top: ['-25%', '110%'] }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }} />
              <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.1 }} className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white"><ShieldCheck size={30} /></motion.span>
              <div className="relative mt-4 font-display text-lg font-semibold text-navy">Running your checks…</div>
            </motion.section>
          ) : result ? (
            <motion.section key="result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }} className="card mt-7 p-6 sm:p-8">
              <Result result={result} />
              <div className="mt-7 flex justify-end">
                {result.status === 'verified' && <Button variant="leaf" className="h-12 px-6 text-base" onClick={() => setUser(result)}><PartyPopper size={18} />Open my dashboard</Button>}
                {result.status === 'pending' && <Button variant="ghost" onClick={recheck}><RefreshCw size={16} />Check again</Button>}
                {result.status === 'rejected' && <Button onClick={() => { setResult(null); setFiles({}) }}><RefreshCw size={16} />Fix and try again</Button>}
              </div>
            </motion.section>
          ) : (
            <motion.section key="form" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease }} className="card mt-7 space-y-6 p-6 sm:p-8">
              {role === 'student' && <>
                <div>
                  <h2 className="text-lg font-semibold">1. Check your details</h2>
                  <p className="mt-1 text-sm text-muted">These must match your college's records. Fix any typo here.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} /></Field>
                    <Field label="College code"><input className="input uppercase" value={f.college_code} onChange={set('college_code')} /></Field>
                    <Field label="Roll number"><input className="input uppercase" value={f.roll_no} onChange={set('roll_no')} /></Field>
                  </div>
                  <LookupNote lookup={lookup} student />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">2. Upload your college ID card</h2>
                  <div className="mt-3"><FileDrop label="College ID card" hint="A photo or scan of the front side (PNG, JPG or PDF)" file={files.id} onFile={file('id')} /></div>
                </div>
              </>}

              {role === 'college' && <>
                {newCollege ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">1. Register your college</h2><Badge tone="info" icon={Sparkles}>New on Credora</Badge></div>
                    <p className="mt-1 text-sm text-muted">The code <b className="text-navy">{user.college_code}</b> is not registered yet, so you are setting it up. Students will use this code to join.</p>
                    <div className="mt-4"><Field label="College name"><input className="input" value={f.college_name} onChange={set('college_name')} placeholder="For example R.M.K. College of Engineering and Technology" /></Field></div>
                    <div className="mt-5 rounded-2xl bg-brand-50/60 p-4">
                      <div className="font-semibold text-navy">Import your students</div>
                      <p className="mt-1 text-sm text-muted">Upload a CSV or Excel (.xlsx) file with a roll number, name and department for each student. Departments are created from the file. You can also do this later. <a className="inline-flex items-center gap-1 font-semibold text-brand-600" href="/api/public/roster-template.csv"><Download size={14} />Download a template</a></p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                        <Field label="Batch"><input className="input" value={f.batch} onChange={set('batch')} placeholder="2023-2027" /></Field>
                        <div className="self-end"><FileDrop label="Students file" hint="CSV or Excel, first row names the columns" accept=".csv,.xlsx" file={files.students} onFile={file('students')} /></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-leaf-50 p-4">
                    <Building2 className="shrink-0 text-leaf-600" size={22} />
                    <div className="text-sm"><b className="text-navy">You are joining {user.college.name}.</b> <span className="text-ink">It is already registered with the code {user.college.code}.</span></div>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold">{newCollege ? '2' : '1'}. Your role</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(meta?.staff_roles || {}).map(([id, name]) => (
                      <button key={id} type="button" aria-pressed={staffRole === id} onClick={() => setStaffRole(id)} className={`relative h-11 rounded-full px-4 text-sm font-semibold ${staffRole === id ? 'text-white' : 'border border-line bg-surface text-navy hover:border-brand-400'}`}>
                        {staffRole === id && <motion.span layoutId="rolePill" className="absolute inset-0 rounded-full bg-brand-600" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                        <span className="relative">{name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-muted">{sensitive ? `${meta?.staff_roles?.[staffRole]} needs a signed letter from the college.` : 'Staff members join with just their staff ID.'} {whole && 'This role covers every department.'}</p>
                  {!whole && user.college?.departments?.length > 0 && (
                    <fieldset className="mt-3">
                      <legend className="label">Departments you work for (leave empty for all)</legend>
                      <div className="flex flex-wrap gap-2">
                        {user.college.departments.map((d) => (
                          <label key={d} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${depts.includes(d) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink'}`}>
                            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={depts.includes(d)} onChange={() => setDepts(depts.includes(d) ? depts.filter((x) => x !== d) : [...depts, d])} />{d}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{newCollege ? '3' : '2'}. Your documents</h2>
                  <div className="mt-3 space-y-3">
                    <FileDrop label="Staff ID card" hint="A photo or scan showing your name and the college" file={files.staff} onFile={file('staff')} />
                    <AnimatePresence>
                      {sensitive && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <FileDrop label={`Letter for ${meta?.staff_roles?.[staffRole]}`} hint="On college letterhead, naming you in this role" file={files.letter} onFile={file('letter')} />
                      </motion.div>}
                    </AnimatePresence>
                  </div>
                </div>
              </>}

              {role === 'recruiter' && <>
                <div className="flex items-center gap-3 rounded-2xl bg-brand-50/60 p-4">
                  <Building2 className="shrink-0 text-brand-600" size={22} />
                  <div className="text-sm"><b className="text-navy">{user.company?.name}</b> <span className="text-ink">· registration {user.company?.reg_no} · {user.designation}</span></div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Upload one document</h2>
                  <div className="mt-3"><FileDrop label="Company ID card or authorisation letter" hint="Anything official that shows you work for this company" file={files.doc} onFile={file('doc')} /></div>
                </div>
              </>}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <p className="flex items-center gap-2 text-xs text-muted"><Lock size={14} />Files are encrypted and used only for this check.</p>
                <Button className="h-12 px-6 text-base" disabled={!ready} onClick={submit}><ShieldCheck size={18} />Verify and continue</Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export function LookupNote({ lookup, student }) {
  if (!lookup) return null
  return (
    <motion.p key={String(lookup.found) + lookup.name} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`mt-2 flex items-center gap-2 text-sm ${lookup.found ? 'text-leaf-600' : 'text-sun-600'}`}>
      {lookup.found ? <><Check size={16} />{lookup.name} is on Credora.</> : <><Info size={16} />{student ? `${lookup.name || 'This college'} has not joined Credora yet. You can continue, and you will be confirmed once your placement cell registers.` : 'This code is new. Enter your college name below to register it.'}</>}
    </motion.p>
  )
}

function Result({ result }) {
  const s = result.status
  const head = {
    verified: ['You are verified', 'Your dashboard is ready.', 'bg-leaf-50 text-leaf-600', ShieldCheck],
    pending: ['Waiting for your college', result.college ? 'Your ID was accepted, but your roll number is not on the student list yet. Your placement cell has been asked to confirm you.'
      : 'Your ID was accepted and your account is saved. Your college has not joined Credora yet, so your dashboard opens once your placement cell registers.', 'bg-sun-50 text-sun-600', Clock],
    rejected: ['One thing needs fixing', 'See the item marked in red below, then try again.', 'bg-rose-50 text-rose-600', XCircle],
  }[s]
  const Icon = head[3]
  return (
    <div>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: result.checks.length * 0.22 }} className={`flex items-center gap-4 rounded-2xl p-4 ${head[2]}`}>
        <Icon size={34} className="shrink-0" />
        <div><div className="font-display text-xl font-semibold">{head[0]}</div><div className="text-sm text-ink">{head[1]}</div></div>
      </motion.div>
      <ul className="mt-5 space-y-2">
        {result.checks.map((c, i) => (
          <motion.li key={c.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.22, duration: 0.3 }} className="flex items-start gap-3 rounded-xl border border-line p-3.5">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.22 + 0.12, type: 'spring', stiffness: 400 }}
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${c.passed === true ? 'bg-leaf-500' : c.passed === false ? 'bg-rose-600' : 'bg-brand-500'}`}>
              {c.passed === true ? <Check size={14} /> : c.passed === false ? <XCircle size={14} /> : <Info size={14} />}
            </motion.span>
            <div><div className="font-semibold text-navy">{c.name}</div><div className="text-sm text-muted">{c.detail}</div></div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
