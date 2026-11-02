import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], importScripts: ['sw-remind.js'] },
      manifest: {
        name: 'Ví Gọn',
        short_name: 'Ví Gọn',
        description: 'Ghi chi tiêu, theo dõi thẻ, ngân sách và sổ chung chia tiền với bạn bè.',
        lang: 'vi',
        theme_color: '#212121',
        background_color: '#212121',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node' },
});
