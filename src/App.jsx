import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import CoffeeShop from './compoents/CoffeeShop'
import Loader from './compoents/Loader'
import AdminPanel from './compoents/admin/AdminPanel'
import CommandePanel from './compoents/commande/CommandePanel'
import CommandPageErrorBoundary from './compoents/commande/CommandPageErrorBoundary'
import ErpControlCenter from './compoents/erp/ErpControlCenter'
import PhaseOneRuntime from './compoents/erp/PhaseOneRuntime'
import PwaInstallBanner from './compoents/erp/PwaInstallBanner'
import { ADMIN_STORAGE_KEYS, DEFAULT_SITE_SETTINGS, loadSiteSettings } from './utils/adminStorage'

function AppNotice({ label, title, description }) {
  return (
    <div className='min-h-screen bg-black text-white flex items-center justify-center px-6'>
      <div className='max-w-xl text-center border border-amber-500/30 bg-white/5 p-8'>
        <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-4'>{label}</p>
        <h1 className='text-3xl sm:text-4xl font-light mb-4'>{title}</h1>
        <p className='text-white/60'>{description}</p>
      </div>
    </div>
  )
}

function CommandeRoute({ interfaceType, siteSettings }) {
  if (!siteSettings.showOrdersModule) {
    return (
      <AppNotice
        label='Commande Module'
        title='Module desactive'
        description='Les interfaces /commandes/staff et /commandes/manager sont desactivees par l administrateur.'
      />
    )
  }

  return (
    <CommandPageErrorBoundary interfaceType={interfaceType}>
      <CommandePanel interfaceType={interfaceType} />
    </CommandPageErrorBoundary>
  )
}

function ClientSiteRoute({ siteSettings }) {
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)

  const handleLoadComplete = () => {
    setIsLoading(false)
    setShowContent(true)
  }

  if (!siteSettings.siteEnabled) {
    return (
      <AppNotice
        label='Maintenance'
        title='Site temporairement indisponible'
        description='Le site client est actuellement desactive par l administrateur. Merci de revenir plus tard.'
      />
    )
  }

  return (
    <>
      <div className={`transition-opacity duration-150 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isLoading && <Loader onLoadComplete={handleLoadComplete} />}
      </div>

      <div className={`${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {showContent && <CoffeeShop />}
      </div>
    </>
  )
}

AppNotice.propTypes = {
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
}

CommandeRoute.propTypes = {
  interfaceType: PropTypes.oneOf(['manager', 'staff']).isRequired,
  siteSettings: PropTypes.shape({
    showOrdersModule: PropTypes.bool,
  }).isRequired,
}

ClientSiteRoute.propTypes = {
  siteSettings: PropTypes.shape({
    siteEnabled: PropTypes.bool,
  }).isRequired,
}

function App() {
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS)

  useEffect(() => {
    const syncSettings = async (event) => {
      const nextKey = event?.detail?.key ?? event?.key
      if (!nextKey || nextKey === ADMIN_STORAGE_KEYS.settings) {
        const settings = await loadSiteSettings()
        setSiteSettings(settings)
      }
    }

    void syncSettings()
    globalThis.addEventListener('storage', syncSettings)
    globalThis.addEventListener('focus', syncSettings)
    globalThis.addEventListener('admin-storage-updated', syncSettings)

    return () => {
      globalThis.removeEventListener('storage', syncSettings)
      globalThis.removeEventListener('focus', syncSettings)
      globalThis.removeEventListener('admin-storage-updated', syncSettings)
    }
  }, [])

  return (
    <>
      <PhaseOneRuntime />
      <Routes>
        <Route path='/chika/super-admin/*' element={<AdminPanel />} />
        <Route path='/erp-control' element={<ErpControlCenter />} />
        <Route
          path='/commandes/manager/*'
          element={<CommandeRoute interfaceType='manager' siteSettings={siteSettings} />}
        />
        <Route
          path='/commandes/staff/*'
          element={<CommandeRoute interfaceType='staff' siteSettings={siteSettings} />}
        />
        <Route path='/commande' element={<CommandeRoute interfaceType='staff' siteSettings={siteSettings} />} />
        <Route path='/commande/*' element={<CommandeRoute interfaceType='staff' siteSettings={siteSettings} />} />
        <Route path='/' element={<ClientSiteRoute siteSettings={siteSettings} />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
      <PwaInstallBanner />
    </>
  )
}

export default App
