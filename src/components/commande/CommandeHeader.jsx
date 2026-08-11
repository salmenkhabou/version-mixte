import { Maximize, Minimize2, RefreshCw, Volume2, VolumeX } from 'lucide-react';

export default function CommandeHeader({
  dashboardTitle,
  pendingCount,
  accessRoleLabel,
  soundEnabled,
  setSoundEnabled,
  kitchenMode,
  setKitchenMode,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  isFullscreen,
  toggleFullscreen,
  refreshOrders,
  canSeeStaffDashboard,
  handleLogout,
}) {
  return (
    <header className='border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-30'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3'>
        <div>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500'>Cafe Commandes</p>
          <h1 className='text-2xl sm:text-3xl font-light'>{dashboardTitle}</h1>
          <p className='text-xs text-white/50 mt-1'>{pendingCount} commande(s) en attente</p>
          <p className='text-[11px] text-white/45 mt-1'>Role actif: {accessRoleLabel}</p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-sm'
            title='Son des notifications'
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            onClick={() => setKitchenMode((prev) => !prev)}
            className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
          >
            {kitchenMode ? 'Mode normal' : 'Mode cuisine'}
          </button>
          {kitchenMode && (
            <button
              onClick={() => setAutoRefreshEnabled((prev) => !prev)}
              className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
              title='Auto-refresh cuisine'
            >
              {autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          )}
          {kitchenMode && (
            <button
              onClick={toggleFullscreen}
              className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
              title='Plein ecran cuisine'
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize size={14} />}
            </button>
          )}
          <button
            onClick={refreshOrders}
            disabled={!canSeeStaffDashboard}
            className='px-4 py-2 border border-white/20 hover:bg-white/10 transition-colors text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed'
          >
            <RefreshCw size={14} /> Rafraichir
          </button>
          <button
            onClick={handleLogout}
            className='px-4 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
