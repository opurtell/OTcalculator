/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app build. The component library has its own config in
// vite.config.lib.ts — see the comment there before moving anything.
export default defineConfig({
  // GitHub Pages serves this repo from https://opurtell.github.io/OTcalculator/,
  // not from the domain root. The Vite default of '/' emits absolute asset URLs
  // that 404 there and the page renders blank with no console error worth the
  // name. IMPLEMENTATION_PLAN.md §4.6 calls this the single most common Pages
  // failure. Do not remove it.
  base: '/OTcalculator/',
  plugins: [react()],
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
