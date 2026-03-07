import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'surge-spa',
      closeBundle() {
        copyFileSync('dist/index.html', 'dist/200.html')
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 700,
  },
})
