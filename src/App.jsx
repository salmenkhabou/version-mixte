import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Component from './compoents/CoffeeShop'
import Loader from './compoents/Loader'
import AdminPanel from './compoents/admin/AdminPanel'
import { ADMIN_STORAGE_KEYS, loadSiteSettings } from './utils/adminStorage'

function App() {
  const isAdminRoute = window.location.pathname.toLowerCase().startsWith('/chika/super-admin')
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const [siteEnabled, setSiteEnabled] = useState(() => loadSiteSettings().siteEnabled)

  useEffect(() => {
    const syncSettings = (event) => {
      if (!event.key || event.key === ADMIN_STORAGE_KEYS.settings) {
        setSiteEnabled(loadSiteSettings().siteEnabled)
      }
    }

    window.addEventListener('storage', syncSettings)
    return () => window.removeEventListener('storage', syncSettings)
  }, [])

  const handleLoadComplete = () => {
    // Immediate transition
    setIsLoading(false)
    setShowContent(true)
  }

  if (isAdminRoute) {
    return <AdminPanel />
  }

  if (!siteEnabled) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-6'>
        <div className='max-w-xl text-center border border-amber-500/30 bg-white/5 p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-4'>Maintenance</p>
          <h1 className='text-3xl sm:text-4xl font-light mb-4'>Site temporairement indisponible</h1>
          <p className='text-white/60'>
            Le site client est actuellement desactive par l administrateur. Merci de revenir plus tard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Loader with instant fade out */}
      <div className={`transition-opacity duration-150 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isLoading && <Loader onLoadComplete={handleLoadComplete} />}
      </div>
      
      {/* Main content appears instantly */}
      <div className={`${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {showContent && <Component />}
      </div>
    </>
  )
}

export default App
