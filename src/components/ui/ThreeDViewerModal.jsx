import { useEffect, useState, useRef } from 'react';
import { X, RotateCw, Sun, Maximize2, Smartphone, Flame, Clock, Sparkles, ChevronLeft, ChevronRight, Check } from 'lucide-react';

// Mapping table for GLB models available in public/ar/models/
const DISH_MODEL_MAP = {
  // Coffee Shop Items
  1: { model: '/ar/models/caffe_latte_espresso_bitter.glb', scale: '1 1 1', name: 'Velvet Cappuccino' },
  2: { model: '/ar/models/caffe_latte_cup.glb', scale: '1.2 1.2 1.2', name: 'Golden Oat Latte' },
  3: { model: '/ar/models/caffe_latte_espresso_bitter.glb', scale: '1 1 1', name: 'Midnight Espresso' },
  4: { model: '/ar/models/caffe_latte_cup.glb', scale: '1.2 1.2 1.2', name: 'Cloud Nine Latte' },
  5: { model: '/ar/models/caffe_latte_cup.glb', scale: '1.2 1.2 1.2', name: 'Rose Garden Latte' },
  6: { model: '/ar/models/caffe_latte_espresso_bitter.glb', scale: '1 1 1', name: 'Midnight Mocha' },
  7: { model: '/ar/models/caffe_latte_cup.glb', scale: '1.2 1.2 1.2', name: 'Matcha Cloud' },
  8: { model: '/ar/models/caffe_latte_cup.glb', scale: '1.2 1.2 1.2', name: 'Iced Caramel Macchiato' },
  
  // AR Menu Food & Drinks
  burger: { model: '/ar/models/burger.glb', scale: '0.9 0.9 0.9', name: 'Classic Burger' },
  pizza: { model: '/ar/models/pizza.glb', scale: '1 1 1', name: 'Margherita Pizza' },
  pasta: { model: '/ar/models/pasta.glb', scale: '1 1 1', name: 'Spaghetti Carbonara' },
  steak: { model: '/ar/models/steak.glb', scale: '1 1 1', name: 'Grilled Ribeye' },
  salad: { model: '/ar/models/salad.glb', scale: '1 1 1', name: 'Garden Salad' },
  tiramisu: { model: '/ar/models/tiramisu.glb', scale: '1 1 1', name: 'Tiramisu' },
  cheesecake: { model: '/ar/models/cheesecake.glb', scale: '0.8 0.8 0.8', name: 'New York Cheesecake' },
  gelato: { model: '/ar/models/gelato.glb', scale: '0.8 0.8 0.8', name: 'Gelato Selection' },
  dessert: { model: '/ar/models/desserts.glb', scale: '1 1 1', name: 'Chocolate Lava Cake' },
  salmon: { model: '/ar/models/grilled_salmon_fish-poly.glb', scale: '1 1 1', name: 'Grilled Salmon' },
  chicken: { model: '/ar/models/roasted_chicken.glb', scale: '1 1 1', name: 'Roasted Chicken' },
  lasagna: { model: '/ar/models/lasagna.glb', scale: '1 1 1', name: 'Beef Lasagna' },
};

export function ThreeDViewerModal({ isOpen, onClose, selectedItem, allItems = [], isDarkMode = true, onSelectDish }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [highLighting, setHighLighting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const modelRef = useRef(null);

  // Dynamically load Google <model-viewer> web component script
  useEffect(() => {
    if (globalThis.customElements?.get('model-viewer')) {
      setModelViewerReady(true);
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    script.onload = () => setModelViewerReady(true);
    script.onerror = () => console.error('Failed to load <model-viewer>');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setModelError(false);
  }, [selectedItem]);

  if (!isOpen || !selectedItem) return null;

  const dishInfo = DISH_MODEL_MAP[selectedItem.id] || DISH_MODEL_MAP[selectedItem.modelKey] || {
    model: selectedItem.model3d || '/ar/models/caffe_latte_cup.glb',
    scale: '1 1 1',
    name: selectedItem.name,
  };

  const modelUrl = selectedItem.model3d || dishInfo.model;

  const handleResetCamera = () => {
    if (modelRef.current) {
      modelRef.current.cameraOrbit = '0deg 75deg 105%';
      modelRef.current.fieldOfView = 'auto';
    }
  };

  const handleTriggerAR = () => {
    if (modelRef.current && modelRef.current.canActivateAR) {
      modelRef.current.activateAR();
    } else {
      // Fallback to standalone AR page
      localStorage.setItem('selectedDish', String(selectedItem.id || 'burger'));
      globalThis.location.href = '/ar/ar.html';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className={`relative w-full max-w-4xl h-[90vh] max-h-[850px] rounded-3xl overflow-hidden border shadow-2xl flex flex-col transition-colors ${
        isDarkMode 
          ? 'bg-gradient-to-b from-[#1C1410] via-[#140D0A] to-[#0A0604] border-amber-500/20 text-white' 
          : 'bg-gradient-to-b from-[#FFFBF7] via-[#F8F1E9] to-[#EFE6DC] border-amber-800/20 text-slate-900'
      }`}>
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
              3D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-light tracking-wide">{selectedItem.name}</h2>
                <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest bg-amber-500 text-black font-semibold rounded-full">
                  Live 360°
                </span>
              </div>
              <p className="text-xs opacity-60 font-light">{selectedItem.subtitle || selectedItem.description || 'Interactive 3D Studio'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerAR}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-medium bg-amber-500 hover:bg-amber-400 text-black rounded-full transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
            >
              <Smartphone size={15} />
              View in AR
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 3D Canvas Viewport */}
        <div className="relative flex-1 w-full bg-radial from-amber-500/5 via-transparent to-transparent flex items-center justify-center overflow-hidden">
          
          {/* Loading Spinner */}
          {!isLoaded && !modelError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-sm">
              <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400 animate-pulse">
                Rendering 3D Model...
              </p>
            </div>
          )}

          {/* Fallback Error message if model fails to load */}
          {modelError && (
            <div className="text-center p-6 max-w-sm z-10">
              <p className="text-red-400 text-sm mb-3">Model preview unavailable for this item.</p>
              <button 
                onClick={handleTriggerAR} 
                className="px-4 py-2 bg-amber-500 text-black text-xs font-semibold rounded-full"
              >
                Launch AR Mode
              </button>
            </div>
          )}

          {/* WebGL Model Viewer */}
          {modelViewerReady && (
            <model-viewer
              ref={modelRef}
              src={modelUrl}
              alt={selectedItem.name}
              ar
              ar-modes="webxr scene-viewer quicklook"
              camera-controls
              touch-action="pan-y"
              auto-rotate={autoRotate ? '' : undefined}
              rotation-per-second="30deg"
              shadow-intensity="1.5"
              shadow-softness="1"
              exposure={highLighting ? '1.8' : '1.2'}
              environment-image="neutral"
              style={{ width: '100%', height: '100%', outline: 'none' }}
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setModelError(true);
                setIsLoaded(true);
              }}
            >
              {/* Callout Hotspots */}
              {selectedItem.prepTime && (
                <button
                  slot="hotspot-time"
                  data-position="0 0.15 0"
                  data-normal="0 1 0"
                  className="px-2.5 py-1 bg-black/70 border border-amber-500/40 backdrop-blur-md rounded-full text-[10px] text-amber-300 flex items-center gap-1 shadow-lg pointer-events-none"
                >
                  <Clock size={12} />
                  {selectedItem.prepTime}
                </button>
              )}

              {selectedItem.calories && (
                <button
                  slot="hotspot-cal"
                  data-position="0.1 0.05 0.1"
                  data-normal="1 0 0"
                  className="px-2.5 py-1 bg-black/70 border border-amber-500/40 backdrop-blur-md rounded-full text-[10px] text-amber-300 flex items-center gap-1 shadow-lg pointer-events-none"
                >
                  <Flame size={12} />
                  {selectedItem.calories} cal
                </button>
              )}
            </model-viewer>
          )}

          {/* Interactive Floating HUD Controls */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-2 text-xs font-light tracking-wider rounded-xl backdrop-blur-md border transition-all flex items-center gap-2 ${
                autoRotate
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
              }`}
              title="Toggle Auto Rotation"
            >
              <RotateCw size={14} className={autoRotate ? 'animate-spin' : ''} />
              <span>Auto Rotate</span>
            </button>

            <button
              onClick={() => setHighLighting(!highLighting)}
              className={`px-3 py-2 text-xs font-light tracking-wider rounded-xl backdrop-blur-md border transition-all flex items-center gap-2 ${
                highLighting
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
              }`}
              title="Toggle Studio Lighting"
            >
              <Sun size={14} />
              <span>Studio Light</span>
            </button>

            <button
              onClick={handleResetCamera}
              className="px-3 py-2 text-xs font-light tracking-wider bg-black/40 border border-white/10 text-white/70 hover:text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-2"
              title="Reset View"
            >
              <Maximize2 size={14} />
              <span>Reset View</span>
            </button>
          </div>

          {/* Hint Overlay */}
          <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <p className="px-4 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white/70 text-[10px] uppercase tracking-[0.25em] rounded-full shadow-lg">
              👆 Drag to rotate • Pinch to zoom
            </p>
          </div>
        </div>

        {/* Bottom Dish Switcher Carousel */}
        {allItems.length > 0 && (
          <div className="border-t border-white/10 bg-black/40 backdrop-blur-md p-3 z-20">
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {allItems.map((item) => {
                const isActive = item.id === selectedItem.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectDish && onSelectDish(item)}
                    className={`flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 text-left ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-500 text-white scale-105'
                        : 'bg-white/5 border-white/5 text-white/60 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                    />
                    <div className="text-xs pr-1">
                      <p className="font-light tracking-wide truncate max-w-[100px]">{item.name}</p>
                      <p className="text-[10px] text-amber-400 font-semibold">{item.price} DT</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
