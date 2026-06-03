import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // On GitHub Pages the app is served from /<repo>/; locally it stays at /.
  // The deploy workflow sets BASE_PATH=/cakes/.
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5173,
    host: true,
  },
})
