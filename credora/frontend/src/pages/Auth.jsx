import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Building2, CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, ShieldCheck } from 'lucide-react'
import { api, useAuth } from '../api.jsx'
import { Button, Field, Logo, StrengthMeter, ThemeToggle, ease, rise, stagger, strength, useToast } from '../ui.jsx'
import CollegePicker from '../CollegePicker.jsx'

const ROLES = [
  { id: 'student', label: 'Student', icon: GraduationCap, desc: 'Find opportunities, check offers, keep verified certificates.' },
  { id: 'college', label: 'College', icon: Building2, desc: 'Upload batches, verify résumés, share data with recruiters.' },
  { id: 'recruiter', label: 'Recruiter', icon: Briefcase, desc: 'Post verified openings and receive student details.' },
]

function AuthLayout({ children, title, sub }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-navy p-12 text-white lg:flex lg:flex-col">
        <div className="blob -left-16 top-24 h-72 w-72 bg-brand-400" />
        <div className="blob bottom-10 right-0 h-64 w-64 bg-sun-500/60" style={{ animationDelay: '-6s' }} />
        <Link to="/" className="relative"><Logo light /></Link>
        <motion.div variants={stagger} initial="hidden" animate="show" className="relative my-auto">
          <motion.h1 variants={rise} className="text-4xl font-bold leading-tight text-white">Find real opportunities. Prove real credentials.</motion.h1>
          <motion.p variants={rise} className="mt-4 max-w-md text-brand-100">One account for scholarships, internships, placements and verified certificates.</motion.p>
          <div className="mt-10 space-y-4">
            {[['Student and college', 'A college code and roll number place the student on the college roster.'],
              ['Placement cell and recruiter', 'The college sends only the details a recruiter asked for.'],
              ['Verified before access', 'Every account passes document checks before its dashboard unlocks.']].map(([t, d]) => (
              <motion.div key={t} variants={rise} className="flex gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
                <CheckCircle2 className="mt-0.5 shrink-0 text-white" size={20} />
                <div><div className="font-semibold">{t}</div><div className="text-sm text-brand-100">{d}</div></div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </aside>
      <main className="relative flex items-center justify-center px-5 py-10">
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="w-full max-w-xl">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mb-7 mt-2 text-muted">{sub}</p>
          {children}
        </motion.div>
      </main>
    </div>
  )
}

function Password({ value, onChange, label = 'Password', auto = 'current-password' }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <span className="relative block">
        <input className="input pr-11" type={show ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => onChange(e.target.value)} required />
        <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-50">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </Field>
  )
}

export function Register() {
  const { signIn, meta } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [role, setRole] = useState('student')
  const [f, setF] = useState({ name: '', email: '', mobile: '', password: '', confirm: '', college_code: '', college_name: '', roll_no: '', cgpa: '', department: '', batch: '2023-2027', company_name: '', reg_no: '', designation: 'HR manager' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => { const v = e.target ? e.target.value : e; setF((prev) => ({ ...prev, [k]: v })) }
  const labels = { student: ['Full name (as on your college ID)', 'Email'], college: ['Staff name', 'Official college email'], recruiter: ['Your full name', 'Work email'] }[role]

  const pickCollege = (v) => setF((prev) => ({ ...prev, ...v }))

  const submit = async (e) => {
    e.preventDefault()
    if (strength(f.password).score < 4) return toast('Choose a stronger password first', 'warn')
    if (f.password !== f.confirm) return toast('The two passwords do not match', 'warn')
    if (role !== 'recruiter' && !f.college_code.trim()) return toast('Choose your college from the list', 'warn')
    setBusy(true)
    try { signIn(await api('/auth/register', { body: { ...f, role } })); nav('/app') }
    catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Create your account" sub={<>Already registered? <Link className="font-semibold text-brand-600" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <div className="label">1. I am registering as</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLES.map((r) => (
              <button type="button" key={r.id} aria-pressed={role === r.id} onClick={() => setRole(r.id)}
                className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${role === r.id ? 'border-transparent' : 'border-line bg-surface hover:border-brand-200'}`}>
                {role === r.id && <motion.span layoutId="rolePick" className="absolute inset-0 rounded-2xl border-2 border-brand-600 bg-brand-50" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <span className="relative">
                  <r.icon className={role === r.id ? 'text-brand-600' : 'text-muted'} size={22} />
                  <span className="mt-2 block font-display font-semibold text-navy">{r.label}</span>
                  <span className="mt-1 block text-xs text-muted">{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="label !mb-0">2. Your details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={labels[0]}><input className="input" autoComplete="name" value={f.name} onChange={set('name')} required /></Field>
            <Field label="Mobile number"><input className="input" type="tel" inputMode="numeric" autoComplete="tel" value={f.mobile} onChange={set('mobile')} required /></Field>
          </div>
          <Field label={labels[1]} hint={role === 'student' ? 'Used to log in and to reset your password.' : 'Must be on your organisation’s own domain. Personal addresses are not accepted.'}>
            <input className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} required />
          </Field>
          <AnimatePresence mode="wait">
            <motion.div key={role} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="space-y-4">
              {role === 'student' && <>
                <CollegePicker code={f.college_code} name={f.college_name} onChange={pickCollege} student />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Roll number"><input className="input uppercase" value={f.roll_no} onChange={set('roll_no')} required /></Field>
                  <Field label="Department" className="sm:col-span-2"><input className="input" value={f.department} onChange={set('department')} placeholder="For example Cyber Security" required /></Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Current CGPA (out of 10)"><input className="input" inputMode="decimal" value={f.cgpa} onChange={set('cgpa')} placeholder="For example 8.2" required /></Field>
                  <Field label="Batch"><select className="input" value={f.batch} onChange={set('batch')}>{(meta?.batches || ['2023-2027']).concat(['2025-2029', '2026-2030']).filter((v, i, a) => a.indexOf(v) === i).map((b) => <option key={b}>{b}</option>)}</select></Field>
                </div>
                <p className="!mt-1.5 text-xs text-muted">CGPA is used to match you with opportunities. You can update it every semester in Profile settings.</p>
              </>}
              {role === 'college' && <>
                <CollegePicker code={f.college_code} name={f.college_name} onChange={pickCollege} />
              </>}
              {role === 'recruiter' && <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company name"><input className="input" autoComplete="organization" value={f.company_name} onChange={set('company_name')} required /></Field>
                  <Field label="CIN or GST number"><input className="input uppercase" value={f.reg_no} onChange={set('reg_no')} required /></Field>
                </div>
                <Field label="Your role in the company"><select className="input" value={f.designation} onChange={set('designation')}>{(meta?.recruiter_roles || ['HR manager']).map((r) => <option key={r}>{r}</option>)}</select></Field>
              </>}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="label !mb-0">3. Create a password</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Password label="Password" auto="new-password" value={f.password} onChange={set('password')} />
            <Password label="Confirm password" auto="new-password" value={f.confirm} onChange={set('confirm')} />
          </div>
          <StrengthMeter pw={f.password} />
        </div>

        <Button loading={busy} className="h-12 w-full text-base">Create {role} account</Button>
        <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-600" />After your first login you will verify your documents. Nothing in the dashboard opens until verification is complete.</p>
      </form>
    </AuthLayout>
  )
}

const DEMO = [['Student', 'kishan@student.example'], ['College', 'anita@sit.example'], ['Recruiter', 'rohan@brightlane.example']]

export function Login() {
  const { signIn } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { signIn(await api('/auth/login', { body: { email, password } })); nav('/app') }
    catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Welcome back" sub={<>New here? <Link className="font-semibold text-brand-600" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Password value={password} onChange={setPassword} />
        <div className="text-right"><Link to="/forgot" className="text-sm font-semibold text-brand-600">Forgot password?</Link></div>
        <Button loading={busy} className="h-12 w-full text-base">Log in</Button>
      </form>
      <div className="mt-8 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
        <div className="text-sm font-semibold text-navy">Demo accounts (sample data)</div>
        <p className="mt-1 text-xs text-muted">Click one to fill the form. Password for all three: <code className="rounded bg-surface px-1.5 py-0.5 font-semibold">Demo@1234</code></p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map(([r, e]) => (
            <motion.button key={e} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => { setEmail(e); setPassword('Demo@1234') }} className="btn-ghost h-10">{r}</motion.button>
          ))}
        </div>
      </div>
    </AuthLayout>
  )
}

export function Forgot() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { setRes(await api('/auth/forgot', { body: { email } })) } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Reset your password" sub="Enter the email you registered with and we will send a one-time reset link.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Button loading={busy} className="h-12 w-full text-base">Send reset link</Button>
      </form>
      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl bg-leaf-50 p-4 text-sm">
            <div className="font-semibold text-leaf-600">{res.message}</div>
            {res.demo_token && <p className="mt-2 text-ink">This prototype has no mail server, so the link appears here instead of your inbox: <Link className="font-semibold text-brand-600 underline" to={`/reset?token=${res.demo_token}`}>open the reset link</Link>. It expires in 30 minutes and works once.</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-6 text-sm"><Link className="font-semibold text-brand-600" to="/login">Back to log in</Link></p>
    </AuthLayout>
  )
}

export function Reset() {
  const [params] = useSearchParams()
  const toast = useToast()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await api('/auth/reset', { body: { token: params.get('token'), password: pw } }); toast(r.message); nav('/login') }
    catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Choose a new password" sub="The link you opened works once and expires after 30 minutes.">
      <form onSubmit={submit} className="space-y-4">
        <Password label="New password" auto="new-password" value={pw} onChange={setPw} />
        <StrengthMeter pw={pw} />
        <Button loading={busy} className="h-12 w-full text-base"><KeyRound size={17} /> Save new password</Button>
      </form>
    </AuthLayout>
  )
}
