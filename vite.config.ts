import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app + offline shell. Only the app's own files are cached;
    // Supabase calls always go to the network (the last good data is kept by
    // useLiveTable in localStorage instead).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['partner.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Partner Ledger',
        short_name: 'Partner',
        description: 'Track partner hands, monthly contributions, the pot and every draw.',
        theme_color: '#123b2e',
        background_color: '#f3f0e8',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Latin font files only; the other subsets (Cyrillic, Vietnamese…) load on demand if ever needed.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'],
      },
    }),
  ],
  // On GitHub Pages the app is served from /<repo>/; locally it stays at /.
  // The deploy workflow sets BASE_PATH=/cakes/.
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5173,
    host: true,
  },
})
