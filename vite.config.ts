import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Saat deploy ke GitHub Pages (`vite build --mode pages`) app tinggal di /<nama-repo>/.
// Default "/" untuk lokal. BASE bisa ditimpa lewat variabel lingkungan.
export default defineConfig(({ mode }) => {
const base = process.env.BASE ?? (mode === 'pages' ? '/duitku/' : '/');

return {
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.png'],
      manifest: {
        name: 'DuitKu',
        short_name: 'DuitKu',
        description: 'Pencatat keuangan pribadi',
        lang: 'id',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#6C5CE7',
        background_color: '#F4F5FA',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node'
  }
} as any;
});
