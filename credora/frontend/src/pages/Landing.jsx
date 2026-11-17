import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Award, Briefcase, Building2, Check, FileSearch, GraduationCap, Lock, QrCode, ScanLine, Search, Send, ShieldAlert, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { useAuth } from '../api.jsx'
import { Logo, ThemeToggle, ease } from '../ui.jsx'

const WORDS = ['scholarship', 'internship', 'job offer', 'certificate']
const MARQUEE = ['Verified students', 'Signed certificates', 'Offer checker', 'QR verification', 'Placement sharing', 'Only requested data', 'Role handover', 'Encrypted documents']

/** The hero centrepiece: product cards stacked in 3D depth that tilt with the pointer. */
function Stack3D() {
  const ref = useRef(null)
  const mx = useMotionValue(0), my = useMotionValue(0)
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-34, 10]), { stiffness: 110, damping: 16 })
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [22, -6]), { stiffness: 110, damping: 16 })
  const [lit, setLit] = useState(0)
  useEffect(() => { const t = setInterval(() => setLit((x) => (x + 1) % 8), 650); return () => clearInterval(t) }, [])
  const move = (e) => { const r = ref.current.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5) }
  return (
    <div ref={ref} onMouseMove={move} onMouseLeave={() => { mx.set(0); my.set(0) }} className="relative mx-auto grid h-[520px] w-full max-w-md place-items-center" style={{ perspective: 1200 }} aria-hidden="true">
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }} className="relative h-[450px] w-[350px] max-w-full">
        <div className="card absolute bottom-20 left-0 right-12 top-8 p-6 shadow-lift">
          <span className="chip bg-leaf-50 text-leaf-600"><ShieldCheck size={13} />Signature valid</span>
          <h3 className="mt-4 text-2xl font-bold leading-tight">Network Security Workshop</h3>
          <p className="mt-2 text-sm text-muted">Issued to Aditi Sharma · 23CY020</p>
          <p className="text-sm text-muted">Signed by Sample Institute of Technology</p>
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }} className="absolute bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-leaf-500 text-leaf-500"><ShieldCheck size={26} /></motion.span>
        </div>
        <div className="card absolute bottom-0 left-16 right-0 p-5 shadow-lift" style={{ transform: 'translateZ(70px)' }}>
          <div className="font-display font-semibold text-navy">Brightlane asked for</div>
          <div className="text-xs text-muted">Security Analyst Internship · Cyber Security</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Full name', 'Roll number', 'CGPA', 'Résumé'].map((f, i) => (
              <span key={f} className={`chip transition-all duration-500 ${i < lit ? 'bg-leaf-50 text-leaf-600' : 'bg-surface2 text-muted opacity-50'}`}>{i < lit && <Check size={12} />}{f}</span>
            ))}
          </div>
        </div>
        <div className="absolute right-2 top-0" style={{ transform: 'translateZ(120px)' }}>
          <div className="card flex animate-floaty items-center gap-2 px-4 py-2.5 text-sm font-semibold text-navy shadow-lift"><span className="h-2 w-2 rounded-full bg-leaf-500" />Sent 4 details for 12 students</div>
        </div>
        <div className="absolute -left-8 top-[47%]" style={{ transform: 'translateZ(130px)' }}>
          <div className="card flex animate-floaty items-center gap-2 px-4 py-2.5 text-sm font-semibold text-navy shadow-lift" style={{ animationDelay: '-3s' }}><ShieldAlert size={16} className="text-rose-600" />Offer check: likely scam</div>
        </div>
      </motion.div>
    </div>
  )
}

function RotatingWord() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2300); return () => clearInterval(t) }, [])
  return (
    <span className="relative inline-block h-[1.15em] overflow-hidden align-bottom" style={{ minWidth: '6.2em' }}>
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease }}
          className="absolute left-0 bg-gradient-to-r from-brand-500 to-sun-500 bg-clip-text text-transparent">{WORDS[i]}</motion.span>
      </AnimatePresence>
    </span>
  )
}

const CHAIN = [
  { icon: GraduationCap, title: 'Student', tone: 'bg-brand-600', text: 'Verifies with a college ID, finds opportunities, checks offers and holds signed certificates.' },
  { icon: Building2, title: 'College', tone: 'bg-leaf-500', text: 'Imports its students, verifies résumés, signs certificates and shares only requested details.' },
  { icon: Briefcase, title: 'Recruiter', tone: 'bg-sun-500', text: 'Posts openings as a verified company and downloads exactly the details it asked for.' },
]
const BENTO = [
  { icon: FileSearch, title: 'Offer checker', text: 'Paste any message or link. Get a risk score and the reasons behind it.', span: 'md:col-span-2', art: 'score' },
  { icon: Award, title: 'Signed certificates', text: 'Every certificate carries the college’s digital signature and a QR code.', span: '', art: 'qr' },
  { icon: Upload, title: 'Import a whole batch', text: 'Upload one CSV or Excel file and every student is on the roster.', span: '' },
  { icon: Send, title: 'Share only what was asked', text: 'The placement cell cannot send a field the recruiter did not request. Credora checks first.', span: 'md:col-span-2', art: 'fields' },
  { icon: Search, title: 'Matched opportunities', text: 'Scholarships, internships and jobs sorted by what you qualify for.', span: '' },
  { icon: Lock, title: 'Private by design', text: 'Documents are encrypted, and students see who received their details.', span: 'md:col-span-2' },
]

function Art({ kind }) {
  if (kind === 'score') return (
    <div className="mt-5 flex items-center gap-4">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="50" fill="none" stroke="rgb(var(--line))" strokeWidth="12" />
          <motion.circle cx="60" cy="60" r="50" fill="none" stroke="#C8322B" strokeWidth="12" strokeLinecap="round" strokeDasharray={314} initial={{ strokeDashoffset: 314 }} whileInView={{ strokeDashoffset: 30 }} viewport={{ once: true }} transition={{ duration: 1.4, ease }} /></svg>
        <span className="absolute inset-0 grid place-items-center font-display text-xl font-bold text-rose-600">92</span>
      </div>
      <div className="flex flex-wrap gap-2">{['Upfront fee', 'Lookalike link', 'Free email'].map((t, i) => <motion.span key={t} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 + i * 0.15 }} className="chip bg-rose-50 text-rose-600">{t}</motion.span>)}</div>
    </div>
  )
  if (kind === 'qr') return <motion.div whileHover={{ rotate: 6, scale: 1.08 }} className="mt-5 grid h-20 w-20 place-items-center rounded-2xl bg-brand-50 text-brand-600"><QrCode size={44} /></motion.div>
  if (kind === 'fields') return (
    <div className="mt-5 flex flex-wrap gap-2">
      {[['Full name', 1], ['CGPA', 1], ['Résumé', 1], ['Mobile number', 0], ['Home address', 0]].map(([t, ok], i) => (
        <motion.span key={t} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`chip ${ok ? 'bg-leaf-50 text-leaf-600' : 'bg-surface2 text-muted line-through'}`}>{ok ? <Check size={13} /> : <X size={13} />}{t}</motion.span>
      ))}
    </div>
  )
  return null
}

export default function Landing() {
  const { user } = useAuth()
  const hero = useRef(null)
  const { scrollYProgress } = useScroll()
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })
  // The soft glow follows the pointer across the hero.
  const move = (e) => {
    const r = hero.current.getBoundingClientRect()
    hero.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
    hero.current.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ scaleX: bar }} className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-brand-600 to-sun-500" />
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/verify" className="btn hidden text-navy hover:bg-surface sm:inline-flex">Check a certificate</Link>
          <ThemeToggle />
          {user ? <Link to="/app" className="btn-primary">Open dashboard</Link> : <>
            <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
            <Link to="/register" className="btn-primary">Get started</Link>
          </>}
        </nav>
      </header>

      <section ref={hero} onMouseMove={move} className="relative" style={{ '--mx': '50%', '--my': '30%' }}>
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(520px circle at var(--mx) var(--my), rgb(var(--brand-200) / 0.55), transparent 65%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:pt-14">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip border border-line bg-surface text-muted"><Sparkles size={13} className="text-sun-500" />HackKumbh 2026 · Tech for Humanity · Education</motion.span>
            <h1 className="mt-6 text-[42px] font-bold leading-[1.08] sm:text-6xl">
              {'Is that'.split(' ').map((w, i) => <motion.span key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease }} className="mr-[0.25em] inline-block">{w}</motion.span>)}
              <br /><RotatingWord /><br />
              <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5, ease }} className="relative inline-block">
                real?
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 120 12" fill="none" aria-hidden="true"><motion.path d="M2 8 C 30 2, 50 12, 80 5 S 110 4, 118 7" stroke="#F27A21" strokeWidth="3.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 0.8 }} /></svg>
              </motion.span>
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-7 max-w-xl text-lg text-muted">
              Credora connects verified students, colleges and recruiters, so nobody has to trust an offer or a certificate blindly.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/app' : '/register'} className="btn-primary group h-12 px-6 text-base">{user ? 'Open dashboard' : 'Create your account'}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>
              <Link to="/login" className="btn-ghost h-12 px-6 text-base">Try a demo account</Link>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.7, ease }}><Stack3D /></motion.div>
        </div>
      </section>

      <div className="relative border-y border-line bg-surface py-4" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((t, i) => <span key={i} className="inline-flex items-center gap-3 font-display text-sm font-semibold uppercase tracking-widest text-muted"><ShieldCheck size={16} className="text-brand-600" />{t}</span>)}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center text-3xl font-bold sm:text-4xl">One chain of trust, three verified roles</motion.h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Everyone is verified before their dashboard opens, so each link in the chain can rely on the one before it.</p>
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-0.5 md:block" aria-hidden="true">
            <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease }} className="h-full origin-left bg-gradient-to-r from-brand-600 via-leaf-500 to-sun-500" />
            <motion.span animate={{ left: ['0%', '100%'] }} transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }} className="absolute -top-[5px] h-3 w-3 rounded-full bg-brand-600 shadow-[0_0_0_6px_rgb(var(--brand-100))]" />
          </div>
          {CHAIN.map((c, i) => (
            <motion.div key={c.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.18, duration: 0.5, ease }} className="relative text-center">
              <motion.span whileHover={{ scale: 1.12, rotate: -6 }} className={`relative z-10 mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lift ${c.tone}`}><c.icon size={28} /></motion.span>
              <div className="card mt-5 p-6">
                <h3 className="text-xl font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center text-3xl font-bold sm:text-4xl">What you can do with it</motion.h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {BENTO.map((b, i) => (
            <motion.div key={b.title} initial={{ opacity: 0, y: 24, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 3) * 0.08, duration: 0.5, ease }}
              whileHover={{ y: -6 }} className={`card group relative overflow-hidden p-6 ${b.span}`}>
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-50 transition-transform duration-500 group-hover:scale-[2.2]" />
              <div className="relative">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white"><b.icon size={20} /></span>
                <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{b.text}</p>
                <Art kind={b.art} />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-14 text-center text-white">
          <div className="blob -right-10 -top-10 h-56 w-56 bg-brand-400" />
          <div className="blob -bottom-16 left-10 h-56 w-56 bg-sun-500/50" style={{ animationDelay: '-5s' }} />
          <h2 className="relative text-3xl font-bold !text-white sm:text-4xl">See it working in two minutes</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">Create an account, pass one quick check and explore the dashboard for your role. Demo accounts are on the login page.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn h-12 bg-[#fff] px-6 text-base text-[#1B43AD] hover:bg-white/90">Create an account</Link>
            <Link to="/login" className="btn h-12 border border-white/40 px-6 text-base text-white hover:bg-white/10">Use a demo account</Link>
          </div>
        </motion.div>
      </section>
      <footer className="border-t border-line bg-surface py-6 text-center text-sm text-muted">Credora prototype · HackKumbh 2026 · All names and figures shown inside are sample data</footer>
    </div>
  )
}
