import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  // ✅ يحذف console.log/debugger تلقائياً من نسخة الإنتاج فقط (npm run build)
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
  plugins: [react()],
  server: { host: true, port: 5173 },
  test: {
    environment: 'node',
    globals: false,
  },
}))
