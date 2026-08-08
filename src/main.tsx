import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Import the stylesheet directly rather than relying on the barrel to pull it
// in. package.json declares `sideEffects: ["**/*.css"]`, which marks every
// non-CSS module — src/ui/index.ts included — as side-effect free, so Rollup
// drops the barrel's own `import './styles.css'` while tree-shaking and the
// app ships with no CSS at all. It renders as unstyled text on a white page,
// which looks identical to the base-path failure and is not what it is.
import './ui/styles.css'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (§4.7). Production only: in dev the worker would cache the
// module graph and fight HMR, which is why vite-pwa.ts emits it on build.
//
// BASE_URL, not '/' — the worker's scope is the directory it is served from,
// and a worker registered at the domain root could not control a page served
// from /OTcalculator/. Same subpath trap as `base` in vite.config.ts.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      // A failed registration is not worth a broken page: the app works
      // online without it, and the console line is enough to debug from.
      .catch((error: unknown) => console.warn('Service worker not registered', error))
  })
}
