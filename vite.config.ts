/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pwa } from './vite-pwa'

// The app build. The component library has its own config in
// vite.config.lib.ts — see the comment there before moving anything.
export default defineConfig({
  // Relative, so one build serves from any path: the custom domain's root
  // (https://otcalc.paramedtools.com/) and the old Pages subpath
  // (opurtell.github.io/OTcalculator/, which GitHub redirects to the domain
  // once it is set). The Vite default of '/' would 404 every asset on the
  // subpath, and '/OTcalculator/' would 404 every asset on the domain — either
  // renders a blank page with no console error worth the name.
  // IMPLEMENTATION_PLAN.md §4.6 calls this the single most common Pages
  // failure. The app has no routes, so a relative base has no downside here.
  base: './',
  // The service worker is emitted on build only — see vite-pwa.ts. In dev it
  // would cache the module graph and fight HMR.
  plugins: [react(), pwa()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // The engine is pure functions and the components render fine through
    // react-dom/server, so no jsdom and no DOM shim are needed. If a test ever
    // needs real events, add jsdom for that file rather than globally.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
