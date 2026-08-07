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
