import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Pay Tracker's embed bundle. Its output names are a contract with that
// repo's scripts/vendor-otcalculator.mjs — do not rename without it.
//
// Run it with `npm run build:embed`.
export default defineConfig({
  plugins: [react()],
  // public/ holds the standalone app's PWA icons and manifest, which the host
  // has no use for.
  publicDir: false,
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
    lib: { entry: resolve(__dirname, 'src/embed.ts'), formats: ['es'], fileName: () => 'embed.js' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? ''
          return name.endsWith('.css') ? 'embed.css' : 'fonts/[name][extname]'
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
})
