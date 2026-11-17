import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, FileText, Info, KeyRound, Lock, Save, ShieldCheck, UserCog } from 'lucide-react'
import { api, useAuth, useLoad } from '../api.jsx'
import { Badge, Button, Card, Field, FileDrop, PageHead, StrengthMeter, ease, useToast } from '../ui.jsx'

export default function Profile() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="Profile settings" sub={user.role === 'student' ? `${user.college?.name} · ${user.roll_no}` : user.role === 'college' ? `${user.college?.name} · College code ${user.college?.code}` : user.company?.name} />
      <div className="space-y-6">
        <Personal />
        {user.role === 'student' && <StudentDetails />}
        {user.role === 'college' && <StaffRole />}
        {user.role === 'recruiter' && <RecruiterRole />}
        <PasswordCard />
        <Documents />
      </div>
    </div>
  )
}

function Personal() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ name: user.name, mobile: user.mobile })
  const [busy, setBusy] = useState(false)
  const save = async (e) => { e.preventDefault(); setBusy(true); try { setUser(await api('/profile', { method: 'PATCH', body: f })); toast('Details saved') } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) } }
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Personal details</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={user.role === 'college' ? 'Staff name' : 'Full name'}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile number"><input className="input" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
        <Field label="Email" hint="Your email is your login and cannot be changed here." className="sm:col-span-2"><input className="input bg-surface2 text-muted" value={user.email} disabled /></Field>
        <Button loading={busy} className="w-fit"><Save size={16} />Save details</Button>
      </form>
    </Card>
  )
}

function StudentDetails() {
  const { user, setUser, meta } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ state: user.state || '', income: user.income ?? '', category: user.category || '', gender: user.gender || '', cgpa: user.cgpa ?? '', consent: user.consent })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => { e.preventDefault(); setBusy(true); try { setUser(await api('/profile', { method: 'PATCH', body: f })); toast('Saved. Your matches are updated.') } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) } }
  return (
    <Card className="p-6" delay={0.05}>
      <h2 className="text-lg font-semibold">Academic and matching details</h2>
      <p className="mt-1 text-sm text-muted">Update your CGPA after each semester. Home state, income, category and gender are used only to match scholarships and are never sent to recruiters.</p>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Home state"><select className="input" value={f.state} onChange={set('state')}><option value="">Choose</option>{(meta?.states || []).map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Family income per year (₹)"><input className="input" inputMode="numeric" value={f.income} onChange={(e) => setF({ ...f, income: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}><option value="">Choose</option>{['General', 'OBC', 'SC', 'ST', 'EWS'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Gender"><select className="input" value={f.gender} onChange={set('gender')}><option value="">Choose</option>{['Female', 'Male', 'Other'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Current CGPA (out of 10)" hint="Recruiters who ask your college for CGPA receive this value." className="sm:col-span-2">
          <input className="input max-w-[180px]" inputMode="decimal" value={f.cgpa} onChange={set('cgpa')} required />
        </Field>
        <div className="grid gap-3 rounded-2xl bg-brand-50/60 p-4 text-sm sm:col-span-2 sm:grid-cols-2">
          <div><div className="text-xs text-muted">Department</div><div className="font-medium text-navy">{user.department}</div></div>
          <div><div className="text-xs text-muted">Roll number and batch</div><div className="font-medium text-navy">{user.roll_no} · {user.batch}</div></div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          <span>Allow my college placement cell to share my details with verified recruiters.</span>
        </label>
        <Button loading={busy} className="w-fit"><Save size={16} />Save</Button>
      </form>
    </Card>
  )
}

function RoleNote({ tone, title, children }) {
  const cls = { warn: 'bg-sun-50 text-sun-600', info: 'bg-brand-50 text-brand-700', ok: 'bg-leaf-50 text-leaf-600' }[tone]
  const I = tone === 'warn' ? AlertTriangle : tone === 'ok' ? ShieldCheck : Info
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden" aria-live="polite">
      <div className={`rounded-2xl p-4 ${cls}`}>
        <div className="flex items-center gap-2 font-semibold"><I size={17} />{title}</div>
        <div className="mt-2 space-y-3 text-sm text-ink">{children}</div>
      </div>
    </motion.div>
  )
}

function StaffRole() {
  const { user, setUser, meta } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState(user.staff_role)
  const [depts, setDepts] = useState(user.staff_depts)
  const [letter, setLetter] = useState(null)
  const [busy, setBusy] = useState(false)
  const roles = meta?.staff_roles || {}
  const changed = role !== user.staff_role
  const deptsChanged = JSON.stringify([...depts].sort()) !== JSON.stringify([...user.staff_depts].sort())
  const sensitive = changed && role !== 'staff'
  const whole = role === 'cpo' || role === 'principal'
  const submit = async () => {
    setBusy(true)
    try {
      if (changed) { const r = await api('/profile/staff-role', { form: { new_role: role, depts: JSON.stringify(depts), letter: sensitive ? letter : undefined } }); setUser(r.user); setDepts(r.user.staff_depts); setLetter(null); toast(r.message) }
      else { const u = await api('/profile', { method: 'PATCH', body: { staff_depts: depts } }); setUser(u); toast('Departments updated') }
    } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  const unique = role === 'hod' ? 'the current head of that department' : whole ? `the current ${roles[role]?.toLowerCase()}` : null
  return (
    <Card className="p-6" delay={0.05}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><UserCog size={19} />Role and departments</h2>
        <Badge tone="ok" icon={ShieldCheck}>Current role: {user.staff_role_name}</Badge>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Role"><select className="input" value={role} onChange={(e) => { setRole(e.target.value); setLetter(null) }}>{Object.entries(roles).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Field>
        <fieldset disabled={whole}>
          <legend className="label">Departments I belong to</legend>
          <div className={`grid gap-x-4 sm:grid-cols-2 ${whole ? 'opacity-50' : ''}`}>
            {(user.college?.departments || []).map((d) => (
              <label key={d} className="flex min-h-[42px] cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={whole || depts.includes(d)} onChange={() => setDepts(depts.includes(d) ? depts.filter((x) => x !== d) : [...depts, d])} />{d}</label>
            ))}
          </div>
          {whole && <p className="mt-1 text-xs text-muted">This role covers every department.</p>}
        </fieldset>
        <AnimatePresence>
          {changed && role === 'staff' && <RoleNote key="staff" tone="info" title="Changing role to Staff member">
            <p>No letter is needed and the change applies as soon as you save. You give up the {user.staff_role_name} role, and it stays vacant until someone is verified for it.</p>
          </RoleNote>}
          {sensitive && <RoleNote key={role} tone="warn" title={`Changing role to ${roles[role]}`}>
            <p>This role needs approval. Upload a signed letter from the college naming you as {roles[role]}. Credora verifies it before the change is made{unique ? `, and ${unique} moves to Staff member automatically` : ''}.</p>
            <FileDrop label="Signed letter from the college" hint="On college letterhead, signed and sealed" file={letter} onFile={setLetter} />
          </RoleNote>}
        </AnimatePresence>
        <Button loading={busy} disabled={(!changed && !deptsChanged) || (sensitive && !letter)} onClick={submit}><Save size={16} />{sensitive ? 'Submit for verification' : changed ? 'Save role change' : 'Save departments'}</Button>
      </div>
    </Card>
  )
}

function RecruiterRole() {
  const { user, setUser, meta } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState(user.designation)
  const [letter, setLetter] = useState(null)
  const [busy, setBusy] = useState(false)
  const changed = role !== user.designation
  const sensitive = changed && role !== 'Team member'
  const submit = async () => {
    setBusy(true)
    try { const r = await api('/profile/designation', { form: { designation: role, letter: sensitive ? letter : undefined } }); setUser(r.user); setLetter(null); toast(r.message) } catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }
  return (
    <Card className="p-6" delay={0.05}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><UserCog size={19} />Role in {user.company?.name}</h2>
        <Badge tone="ok" icon={ShieldCheck}>Current role: {user.designation}</Badge>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Role"><select className="input" value={role} onChange={(e) => { setRole(e.target.value); setLetter(null) }}>{(meta?.recruiter_roles || []).map((r) => <option key={r}>{r}</option>)}</select></Field>
        <AnimatePresence>
          {changed && !sensitive && <RoleNote key="tm" tone="info" title="Changing role to Team member"><p>No letter is needed. The change applies as soon as you save.</p></RoleNote>}
          {sensitive && <RoleNote key={role} tone="warn" title={`Changing role to ${role}`}>
            <p>This role needs approval. Upload a signed letter from the company naming you as {role}. If only one person can hold the role, the previous holder moves to Team member automatically.</p>
            <FileDrop label="Signed letter from the company" hint="On company letterhead" file={letter} onFile={setLetter} />
          </RoleNote>}
        </AnimatePresence>
        <Button loading={busy} disabled={!changed || (sensitive && !letter)} onClick={submit}><Save size={16} />{sensitive ? 'Submit for verification' : 'Save role change'}</Button>
      </div>
    </Card>
  )
}

function PasswordCard() {
  const toast = useToast()
  const [f, setF] = useState({ current: '', new: '' })
  const [busy, setBusy] = useState(false)
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api('/profile/password', { body: f }); setF({ current: '', new: '' }); toast('Password changed') } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) } }
  return (
    <Card className="p-6" delay={0.1}>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound size={19} />Change password</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></Field>
        <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={f.new} onChange={(e) => setF({ ...f, new: e.target.value })} required /></Field>
        <div className="sm:col-span-2"><StrengthMeter pw={f.new} /></div>
        <Button loading={busy} className="w-fit">Change password</Button>
      </form>
    </Card>
  )
}

const KIND = { college_id: 'College ID card', aadhaar_masked: 'Masked Aadhaar', resume: 'Résumé', staff_id: 'Staff ID card', role_letter: 'Role authorisation letter', recognition_letter: 'College recognition letter', incorporation: 'Incorporation certificate', authorisation: 'Recruiter authorisation' }
function Documents() {
  const [docs] = useLoad('/student/documents')
  if (!docs?.length) return null
  return (
    <Card className="p-6" delay={0.15}>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Lock size={19} />Document locker</h2>
      <p className="mt-1 text-sm text-muted">Files you uploaded for verification. They are stored encrypted and only you can open them.</p>
      <ul className="mt-3 divide-y divide-line">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-3 text-sm">
            <FileText size={18} className="text-brand-600" />
            <span className="flex-1"><span className="font-medium text-navy">{KIND[d.kind] || d.kind}</span><span className="block text-xs text-muted">{d.filename} · {d.date}</span></span>
            <Badge tone="ok" icon={Lock}>Encrypted</Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}
