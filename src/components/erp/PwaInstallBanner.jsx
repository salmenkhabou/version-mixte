import { useEffect, useMemo, useState } from 'react';

const DISMISS_STORAGE_KEY = 'pwa_install_banner_dismissed';

function isStandaloneMode() {
  const mediaStandalone = globalThis.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = Boolean(globalThis.navigator?.standalone);
  return Boolean(mediaStandalone || iosStandalone);
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    return globalThis.localStorage?.getItem(DISMISS_STORAGE_KEY) === '1';
  });

  const canShow = useMemo(() => {
    if (dismissed) return false;
    if (isStandaloneMode()) return false;
    return Boolean(deferredPrompt);
  }, [deferredPrompt, dismissed]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    globalThis.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      globalThis.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      setDeferredPrompt(null);
      setDismissed(true);
      globalThis.localStorage?.setItem(DISMISS_STORAGE_KEY, '1');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    globalThis.localStorage?.setItem(DISMISS_STORAGE_KEY, '1');
  };

  if (!canShow) return null;

  return (
    <div className='fixed bottom-4 left-4 right-4 z-50 border border-amber-500/40 bg-black/90 text-white px-4 py-3 shadow-xl backdrop-blur-sm'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-xs tracking-widest uppercase text-amber-400'>Install App</p>
          <p className='text-sm text-white/85'>Install Brew ERP on your phone for faster access and offline support.</p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleInstall}
            className='px-3 py-2 text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors'
          >
            Install
          </button>
          <button
            type='button'
            onClick={handleDismiss}
            className='px-3 py-2 text-xs border border-white/25 text-white/80 hover:bg-white/10 transition-colors'
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
