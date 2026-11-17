import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, BadgeCheck, Briefcase, ClipboardCheck, FileSearch, LayoutDashboard, LogOut, Menu, QrCode, Search, Send, Settings, Share2, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../api.jsx'
import { Logo, ThemeToggle, ease } from '../ui.jsx'
import Student from './Student.jsx'
import College from './College.jsx'
import Recruiter from './Recruiter.jsx'
import Profile from './Profile.jsx'

export const NAV = {
  student: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'opportunities', label: 'Opportunities', icon: Search },
    { id: 'check', label: 'Check an offer', icon: FileSearch }, { id: 'applications', label: 'My applications', icon: ClipboardCheck },
    { id: 'wallet', label: 'Credential wallet', icon: Award }, { id: 'shared', label: 'Shared data', icon: Share2 },
    { id: 'profile', label: 'Profile settings', icon: Settings },
  ],
  college: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'students', label: 'Students', icon: Users },
    { id: 'approvals', label: 'Approvals', icon: ClipboardCheck }, { id: 'certificates', label: 'Certificates', icon: Award },
    { id: 'placement', label: 'Placement cell', icon: Send }, { id: 'profile', label: 'Profile settings', icon: Settings },
  ],
  recruiter: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'applicants', label: 'Applicants', icon: Users },
    { id: 'details', label: 'Student details', icon: Briefcase }, { id: 'verify', label: 'Verify a certificate', icon: QrCode },
    { id: 'profile', label: 'Profile settings', icon: Settings },
  ],
}
const PAGES = { student: Student, college: College, recruiter: Recruiter }
const ROLE_TONE = { student: 'bg-brand-500', college: 'bg-leaf-500', recruiter: 'bg-sun-500' }

export default function Shell() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const tab = pathname.split('/')[2] || 'overview'
  const nav = NAV[user.role]
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }) }, [tab])
  if (!nav.some((n) => n.id === tab)) return <Navigate to="/app/overview" replace />
  const Page = tab === 'profile' ? Profile : PAGES[user.role]
  const sub = user.role === 'student' ? `${user.department} · ${user.batch}` : user.role === 'college' ? user.staff_role_name : user.designation

  return (
    <div className="min-h-screen">
      {/* Desktop: a slim icon rail that widens to show labels when you point at it or tab into it. */}
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col overflow-hidden bg-side py-4 text-white shadow-lift transition-[width] duration-300 ease-out hover:w-60 focus-within:w-60 lg:flex">
        <Link to="/" aria-label="Credora home" className="mx-[14px] flex h-11 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600"><ShieldCheck size={22} strokeWidth={2.4} /></span>
          <span className="whitespace-nowrap font-display text-xl font-bold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">Credora</span>
        </Link>
        <nav aria-label="Main menu" className="mt-6 flex-1 space-y-1 px-[14px]">
          {nav.map((n) => (
            <Link key={n.id} to={`/app/${n.id}`} aria-label={n.label} aria-current={tab === n.id ? 'page' : undefined}
              className={`relative flex h-11 items-center rounded-xl transition-colors ${tab === n.id ? 'text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
              {tab === n.id && <motion.span layoutId="railPill" className="absolute inset-0 rounded-xl bg-white/15" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative grid h-11 w-11 shrink-0 place-items-center"><n.icon size={19} /></span>
              <span className="relative whitespace-nowrap pr-3 text-[15px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">{n.label}</span>
            </Link>
          ))}
        </nav>
        <button onClick={signOut} aria-label="Sign out" className="mx-[14px] flex h-11 items-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center"><LogOut size={18} /></span>
          <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">Sign out</span>
        </button>
      </aside>

      {/* Top bar: who is signed in, the theme switch and (on phones) the menu button. */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur lg:pl-[72px]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-brand-50 lg:hidden"><Menu size={22} /></button>
            <span className="lg:hidden"><Logo small /></span>
            <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white lg:inline-flex ${ROLE_TONE[user.role]}`}>{user.role}</span>
            <span className="hidden items-center gap-1.5 text-sm text-muted md:inline-flex"><BadgeCheck size={15} className="text-leaf-500" />Verified account</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/app/profile" className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 hover:bg-brand-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 font-display font-bold text-white">{user.name[0]}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[180px] truncate text-sm font-semibold text-navy">{user.name}</span>
                <span className="block max-w-[180px] truncate text-xs text-muted">{sub}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.3, ease }} className="absolute inset-y-0 left-0 flex w-64 flex-col bg-side p-5 text-white">
              <div className="flex items-center justify-between"><Logo light /><button aria-label="Close menu" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"><X size={20} /></button></div>
              <nav aria-label="Main menu" className="mt-6 flex-1 space-y-1">
                {nav.map((n) => (
                  <Link key={n.id} to={`/app/${n.id}`} aria-current={tab === n.id ? 'page' : undefined} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${tab === n.id ? 'bg-white/15 font-semibold text-white' : 'text-white/70'}`}><n.icon size={18} />{n.label}</Link>
                ))}
              </nav>
              <button onClick={signOut} className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:bg-white/10"><LogOut size={16} />Sign out</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="px-4 py-6 sm:px-8 sm:py-8 lg:pl-[104px]">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }} className="mx-auto max-w-[1240px]">
            <Page tab={tab} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
