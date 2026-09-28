import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// PWA hors-ligne (§8 lot 8) : vite-plugin-pwa (Workbox) compatible Vite 8 (peerDependencies
// couvre déjà ^8.0.0, vérifié aussi par un `npm run build` réel avant de l'adopter — voir
// docs/externat/DECISIONS.md). manifest: false car public/site.webmanifest existe déjà et reste
// la seule source du manifeste, jamais un second généré par le plugin (§8 : "plutôt que d'en créer
// un second").
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        // Les polices Google (chargées par <link> dans index.html) et les images Supabase Storage
        // ne sont jamais mises en cache par le SW — hors périmètre du "met en cache l'application"
        // du §8, et un cache d'images non borné irait à l'encontre du quota Storage 1 Go (§9).
        navigateFallbackDenylist: [/^\/supabase\//],
      },
    }),
  ],
})
