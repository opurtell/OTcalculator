import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Station Ledger component library build, kept separate from the app build
// in vite.config.ts. This one emits the bundle the design-sync converter reads,
// so its entry, output names and outDir must not move without updating
// .design-sync/config.json and .design-sync/NOTES.md alongside them.
//
// Run it with `npm run build:lib`.
export default defineConfig({
  plugins: [react()],
  // public/ holds the app's PWA icons and manifest. They are not part of the
  // component library, and copying them into dist-lib would put them in the
  // bundle the design-sync converter reads.
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: resolve(__dirname, 'src/ui/index.ts'),
      name: 'ActasOtUi',
      fileName: 'actas-ot-ui',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
        // The stylesheet gets a stable name (package.json `style` and the
        // design-sync cssEntry both point at it); fonts keep their own names
        // so the two weights don't collide into one file.
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? ''
          return name.endsWith('.css') ? 'actas-ot-ui.css' : 'fonts/[name][extname]'
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
})
