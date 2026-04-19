import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AccessProvider } from './contexts/AccessContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { registerServiceWorker } from './pwa/registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AccessProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AccessProvider>
    </BrowserRouter>
  </StrictMode>,
)
