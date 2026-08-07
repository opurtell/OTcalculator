import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build only. Phase 0 adds the app build alongside this; when it does,
// the app config is the one that needs base: '/OTcalculator/' for GitHub Pages.
export default defineConfig({
  plugins: [react()],
  build: {
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
