import { useEffect, useRef, useState } from 'react';
import { X, Camera, Flashlight, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Hash } from 'lucide-react';

export function QrScannerModal({ isOpen, onClose, onScanSuccess, mode = 'general', isDarkMode = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [manualInput, setManualInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [jsQrReady, setJsQrReady] = useState(false);

  // Dynamically load jsQR library from CDN if not loaded
  useEffect(() => {
    if (globalThis.jsQR) {
      setJsQrReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => setJsQrReady(true);
    script.onerror = () => setCameraError('Impossible de charger le decodeur QR code.');
    document.head.appendChild(script);
  }, []);

  // Camera start / stop effect
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (facing) => {
    setCameraError('');
    setScanResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Votre navigateur ne supporte pas l accès a la camera.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', true); // critical for iOS Safari
        await videoRef.current.play();
        setIsScanning(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.error('QR Scanner Camera Error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Permission de la camera refusee. Veuillez autoriser l acces camera dans les parametres.');
      } else {
        setCameraError('Erreur d acces a la camera: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  // Real-time scan loop using jsQR
  const tickScan = () => {
    if (!videoRef.current || !canvasRef.current || !globalThis.jsQR) {
      animFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = globalThis.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleCodeDetected(code.data);
        return; // Pause scanning loop on hit
      }
    }

    animFrameRef.current = requestAnimationFrame(tickScan);
  };

  const handleCodeDetected = (rawData) => {
    // Play haptic & sound feedback
    if (navigator.vibrate) {
      try { navigator.vibrate(120); } catch { /* ignore */ }
    }

    let parsed = { raw: rawData, type: 'general' };

    // Try parsing Table number
    const tableMatch = rawData.match(/(?:table[=:\s]*|#)(\d+)/i) || rawData.match(/^(\d{1,3})$/);
    if (tableMatch) {
      parsed.type = 'table';
      parsed.tableNumber = tableMatch[1];
    }

    // Try parsing Item / Dish
    const itemMatch = rawData.match(/(?:item|coffee|dish)[=:\s]*([a-z0-9_-]+)/i);
    if (itemMatch) {
      parsed.type = 'item';
      parsed.itemId = itemMatch[1];
    }

    setScanResult(parsed);

    setTimeout(() => {
      if (onScanSuccess) {
        onScanSuccess(parsed);
      }
      onClose();
    }, 800);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities && track.getCapabilities().torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.warn('Torch constraint failed:', err);
      }
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeDetected(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className={`relative w-full max-w-md rounded-3xl overflow-hidden border shadow-2xl flex flex-col transition-colors ${
        isDarkMode
          ? 'bg-gradient-to-b from-[#1C1410] to-[#0A0604] border-amber-500/30 text-white'
          : 'bg-gradient-to-b from-[#FFFBF7] to-[#EFE6DC] border-amber-800/20 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-base font-light tracking-wide">
                {mode === 'table' ? 'Scanner Table QR' : 'Scanner QR Code'}
              </h3>
              <p className="text-[11px] opacity-60 font-light">Placez le QR Code dans le cadre</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Target Alignment Overlay Frame */}
          {!cameraError && !scanResult && (
            <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
              <div className="relative w-64 h-64 border-2 border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.2)] flex items-center justify-center">
                {/* Laser animation */}
                <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] animate-bounce" />

                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-500 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-500 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-500 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-500 rounded-br-xl" />
              </div>
            </div>
          )}

          {/* Scan Success Indicator */}
          {scanResult && (
            <div className="absolute inset-0 bg-amber-500/90 backdrop-blur-md flex flex-col items-center justify-center text-black p-6 animate-fadeIn">
              <CheckCircle2 size={64} className="mb-3 animate-bounce" />
              <p className="text-xl font-semibold tracking-wide">QR Code Valide !</p>
              <p className="text-xs uppercase tracking-widest font-mono mt-2 bg-black/10 px-3 py-1 rounded-full">
                {scanResult.type === 'table' ? `Table N° ${scanResult.tableNumber}` : scanResult.raw}
              </p>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center text-amber-200">
              <AlertCircle size={48} className="text-amber-500 mb-3" />
              <p className="text-sm mb-4">{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-amber-500 text-black text-xs font-semibold rounded-full"
              >
                Reessayer la camera
              </button>
            </div>
          )}

          {/* Camera Controls Bar */}
          {!cameraError && (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20">
              <button
                onClick={toggleTorch}
                className={`p-3 rounded-full backdrop-blur-md border transition-all ${
                  torchOn ? 'bg-amber-500 text-black border-amber-400' : 'bg-black/50 text-white border-white/20'
                }`}
                title="Torche"
              >
                <Flashlight size={18} />
              </button>

              <button
                onClick={flipCamera}
                className="p-3 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-black/70 transition-all"
                title="Changer de camera"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="p-4 border-t border-white/10 bg-black/30 backdrop-blur-md">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/70" />
              <input
                type="text"
                placeholder={mode === 'table' ? "Ou saisissez N° Table..." : "Ou saisissez le code QR..."}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-3 py-2 text-xs font-light tracking-wide focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-black text-xs font-medium uppercase tracking-wider rounded-2xl hover:bg-amber-400 transition-colors"
            >
              Valider
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
