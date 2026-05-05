import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard.html'),
        'dashboard-admin': resolve(__dirname, 'src/dashboard-admin.html'),
        'dashboard-jury': resolve(__dirname, 'src/dashboard-jury.html'),
        'tournament-arena': resolve(__dirname, 'src/tournament-arena.html'),
        'tournament-registration': resolve(__dirname, 'src/tournament-registration.html'),
        'profile-edit': resolve(__dirname, 'src/profile-edit.html'),
        faq: resolve(__dirname, 'src/faq.html'),
        protocol: resolve(__dirname, 'src/protocol.html'),
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@js': resolve(__dirname, 'src/js'),
      '@components': resolve(__dirname, 'src/js/components'),
      '@core': resolve(__dirname, 'src/js/core'),
      '@css': resolve(__dirname, 'src/css'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'WRC 2026 - World Rap Championship',
        short_name: 'WRC 2026',
        description: 'The biggest rap tournament in the world',
        theme_color: '#050508',
        background_color: '#050508',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
});
