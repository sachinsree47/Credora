import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from './api.jsx'
import Landing from './pages/Landing.jsx'
import { Forgot, Login, Register, Reset } from './pages/Auth.jsx'
import Gate from './pages/Gate.jsx'
import Shell from './pages/Shell.jsx'
import VerifyCert from './pages/VerifyCert.jsx'
import { Logo } from './ui.jsx'

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.4 }}><Logo /></motion.div>
    </div>
  )
}

/** Everything under /app needs a login. An unverified account only ever sees the verification gate. */
function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return user.status === 'verified' ? <Shell /> : <Gate />
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to="/app" replace /> : children
}

export default function App() {
  const location = useLocation()
  const key = location.pathname.startsWith('/app') ? '/app' : location.pathname
  return (
    <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/verify" element={<VerifyCert />} />
          <Route path="/verify/:id" element={<VerifyCert />} />
          <Route path="/app/*" element={<Protected />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </motion.div>
  )
}
