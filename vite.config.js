import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunkFor = (id) => {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react'
  if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase'
  // Keep PDF export dependencies out of manual chunks so Vite's preload helper
  // does not make the PDF vendor chunk an initial dependency of the app shell.
  if (id.includes('/jspdf/') || id.includes('/html2canvas/') || id.includes('/dompurify/')) return undefined
  if (id.includes('/three/')) return 'vendor-three'
  return 'vendor-misc'
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunkFor,
      },
    },
  },
})
