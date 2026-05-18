import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase':     ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'recharts':     ['recharts'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})
