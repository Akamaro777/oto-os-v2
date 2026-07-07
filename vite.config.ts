import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// GitHub Pages serves a project site under /<repo>/. Set this to your repo name.
// If you deploy at a domain root (Netlify/Vercel/custom domain), set '/'.
const REPO = 'oto-os-v2'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // '/' during local dev; '/<repo>/' for the production build on GitHub Pages.
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Custom SW (src/sw.ts): precaching + Web Push handlers
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'oto.os',
        short_name: 'oto.os',
        description: "Oto's personal operating system",
        theme_color: '#0c0d10',
        background_color: '#0c0d10',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
