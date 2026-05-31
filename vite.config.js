import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
      '/tasks': 'http://localhost:8000',
      '/models': 'http://localhost:8000',
    },
  },
})
