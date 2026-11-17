import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development the frontend runs on :5173 and forwards API calls to the backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
