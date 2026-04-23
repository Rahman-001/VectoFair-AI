import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' base ensures relative asset paths — required for Android WebView (file:// protocol)
  base: './',
})
