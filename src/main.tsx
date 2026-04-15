import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { KioskView } from './components/KioskView.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const pathname = window.location.pathname
const isKiosk = pathname === '/kiosk' || pathname.startsWith('/kiosk/')

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    {isKiosk ? <KioskView /> : <App />}
  </ErrorBoundary>
)
