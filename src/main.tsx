import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { KioskView } from './components/KioskView.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Route to KioskView when the URL path is /kiosk (or starts with /kiosk/).
// This app has no client-side router; users navigate directly to /kiosk via the
// browser address bar or a bookmark. A page load or reload at /kiosk is required
// to switch between the main app and kiosk mode.
const pathname = window.location.pathname
const isKiosk = pathname === '/kiosk' || pathname.startsWith('/kiosk/')

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    {isKiosk ? <KioskView /> : <App />}
  </ErrorBoundary>
)
