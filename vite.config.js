import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.jpg'],
      manifest: {
        name: 'KSA LeidingsApp',
        short_name: 'KSA App',
        description: 'De officiële KSA LeidingsApp voor strepen, agenda, frituur en meer.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Pushmeldingen tonen en openen (public/push-sw.js)
        importScripts: ['push-sw.js'],
        // Supabase-data wordt bewust NIET gecachet: strepen, saldo en facturen moeten altijd actueel zijn.
        // (Vroeger stond hier StaleWhileRevalidate, waardoor de app eerst verouderde gegevens toonde.)
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
});
