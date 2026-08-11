import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_STORAGE_KEYS,
  DEFAULT_SITE_SETTINGS,
  loadCoffeeItems,
  loadSiteSettings,
} from '../../utils/adminStorage';
import { createOrder } from '../../utils/orderService';
import { useMobile } from '../use-mobile';
import { useLastOrderStatusPolling } from '../hooks/useLastOrderStatusPolling';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  CART_ITEMS_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  LAST_ORDER_STORAGE_KEY,
  PHONE_REGEX,
  TABLE_NUMBER_REGEX,
} from './constants';
import { DEFAULT_COFFEE_ITEMS, normalizeClientItem, normalizeStoredArray, normalizeStoredLastOrder } from './data';

export function useCoffeeShop() {
  const isMobile = useMobile();

  const [currentView, setCurrentView] = useState('shop');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [favorites, setFavorites] = usePersistentState(FAVORITES_STORAGE_KEY, [], {
    normalize: normalizeStoredArray,
    readErrorLabel: 'favorites',
    writeErrorLabel: 'favorites',
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [cartItems, setCartItems] = usePersistentState(CART_ITEMS_STORAGE_KEY, [], {
    normalize: normalizeStoredArray,
    readErrorLabel: 'cart',
    writeErrorLabel: 'cart',
  });
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderMsg, setOrderMsg] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [lastOrder, setLastOrder] = usePersistentState(LAST_ORDER_STORAGE_KEY, null, {
    normalize: normalizeStoredLastOrder,
    removeWhen: (value) => !value,
    readErrorLabel: 'last order',
    writeErrorLabel: 'last order',
  });

  useLastOrderStatusPolling(lastOrder, setLastOrder);

  const coffeeItems = DEFAULT_COFFEE_ITEMS;
  const [managedCoffeeItems, setManagedCoffeeItems] = useState(() => coffeeItems.map(normalizeClientItem));

  const effectiveCoffeeItems = managedCoffeeItems.length > 0 ? managedCoffeeItems : coffeeItems.map(normalizeClientItem);
  const menuCoffeeItems = effectiveCoffeeItems.filter((item) => item.isAvailable !== false);
  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const categories = useMemo(() => [
    { name: 'All', icon: '☕', count: menuCoffeeItems.length },
    { name: 'Trending', icon: '🔥', count: menuCoffeeItems.filter((item) => item.isTrending).length },
    { name: 'New', icon: '✨', count: menuCoffeeItems.filter((item) => item.isNew).length },
    { name: 'Premium', icon: '💎', count: menuCoffeeItems.filter((item) => Number(item.price) > 20).length },
    { name: 'Iced', icon: '❄️', count: menuCoffeeItems.filter((item) => String(item.name).toLowerCase().includes('iced')).length },
  ], [menuCoffeeItems]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(globalThis.scrollY > 50);
    };
    globalThis.addEventListener('scroll', handleScroll);
    return () => globalThis.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const syncAdminConfig = async (event) => {
      const nextKey = event?.detail?.key ?? event?.key;
      const shouldSyncSettings = !nextKey || nextKey === ADMIN_STORAGE_KEYS.settings;
      const shouldSyncItems = !nextKey || nextKey === ADMIN_STORAGE_KEYS.items;
      if (!shouldSyncSettings && !shouldSyncItems) return;

      const [nextSettings, nextItems] = await Promise.all([
        loadSiteSettings(),
        loadCoffeeItems(coffeeItems),
      ]);

      setSiteSettings(nextSettings);
      setManagedCoffeeItems(
        (Array.isArray(nextItems) ? nextItems : coffeeItems).map(normalizeClientItem)
      );
    };

    globalThis.addEventListener('storage', syncAdminConfig);
    globalThis.addEventListener('focus', syncAdminConfig);
    globalThis.addEventListener('admin-storage-updated', syncAdminConfig);

    void syncAdminConfig();

    return () => {
      globalThis.removeEventListener('storage', syncAdminConfig);
      globalThis.removeEventListener('focus', syncAdminConfig);
      globalThis.removeEventListener('admin-storage-updated', syncAdminConfig);
    };
  }, [coffeeItems]);

  useEffect(() => {
    if (!siteSettings.showGames && currentView === 'game') {
      setCurrentView('shop');
    }
  }, [siteSettings.showGames, currentView]);

  useEffect(() => {
    if (!siteSettings.showOrdersModule && currentView === 'cart') {
      setCurrentView('shop');
    }
  }, [siteSettings.showOrdersModule, currentView]);

  useEffect(() => {
    const availableIds = new Set(
      managedCoffeeItems
        .filter((item) => item.isAvailable !== false)
        .map((item) => Number(item.id))
    );
    setCartItems((prev) => {
      const next = prev.filter((item) => availableIds.has(Number(item.id)));
      if (next.length !== prev.length) {
        setOrderMsg('Certains articles en rupture ont ete retires du panier.');
        return next;
      }
      return prev;
    });
  }, [managedCoffeeItems, setCartItems]);

  useEffect(() => {
    const availableIds = new Set(
      managedCoffeeItems
        .filter((item) => item.isAvailable !== false)
        .map((item) => Number(item.id))
    );

    setFavorites((prev) => {
      const next = prev.filter((id) => availableIds.has(Number(id)));
      if (next.length !== prev.length) {
        return next;
      }
      return prev;
    });
  }, [managedCoffeeItems, setFavorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearAllFavorites = () => {
    if (confirm('هل تريد حذف جميع المفضلة؟')) {
      setFavorites([]);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const addToCart = (item) => {
    if (!siteSettings.showOrdersModule) {
      setOrderMsg('Le module commande est desactive pour le moment.');
      return;
    }

    if (item?.isAvailable === false) {
      setOrderMsg('Article en rupture pour le moment.');
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((entry) => Number(entry.id) === Number(item.id));
      if (existing) {
        return prev.map((entry) =>
          Number(entry.id) === Number(item.id)
            ? { ...entry, quantity: Number(entry.quantity || 0) + 1 }
            : entry
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          image: item.image,
          quantity: 1,
        },
      ];
    });

    setOrderMsg(`${item.name} ajoute au panier.`);
  };

  const updateCartQuantity = (itemId, delta) => {
    setCartItems((prev) => {
      const next = prev
        .map((item) =>
          Number(item.id) === Number(itemId)
            ? { ...item, quantity: Number(item.quantity || 0) + delta }
            : item
        )
        .filter((item) => Number(item.quantity) > 0);
      return next;
    });
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) => prev.filter((item) => Number(item.id) !== Number(itemId)));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const resetOrderForm = () => {
    setCartItems([]);
    setTableNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderNotes('');
  };

  const submitOrder = async () => {
    if (!siteSettings.showOrdersModule) {
      setOrderMsg('Module commande desactive par l administrateur.');
      return;
    }

    if (isSubmittingOrder) return;

    if (!TABLE_NUMBER_REGEX.test(String(tableNumber || '').trim())) {
      setOrderMsg('Numero de table invalide (1 a 3 chiffres).');
      return;
    }

    const normalizedPhone = String(customerPhone || '').trim();

    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      setOrderMsg('Telephone invalide (8 a 15 chiffres, + optionnel).');
      return;
    }

    if (cartItems.length === 0) {
      setOrderMsg('Le panier est vide.');
      return;
    }

    setIsSubmittingOrder(true);

    const result = await createOrder({
      tableNumber,
      customerName,
      customerPhone: normalizedPhone,
      notes: orderNotes,
      items: cartItems,
      idempotencyKey: `${Date.now()}-${tableNumber}`,
    });

    setIsSubmittingOrder(false);

    if (!result.ok) {
      setOrderMsg(`Erreur commande: ${result.message}`);
      return;
    }

    if (result.queued) {
      setLastOrder(null);
      setOrderMsg(result.message || 'Commande enregistree hors ligne. Synchronisation en attente.');
      resetOrderForm();
      return;
    }

    setLastOrder({
      orderNumber: result.order?.orderNumber,
      tableNumber: String(tableNumber).trim(),
      status: result.order?.status || 'pending',
      createdAt: result.order?.createdAt || new Date().toISOString(),
      updatedAt: result.order?.createdAt || new Date().toISOString(),
    });

    setOrderMsg(
      result.order?.orderNumber
        ? `Commande ${result.order.orderNumber} envoyee avec succes.`
        : 'Commande envoyee avec succes.'
    );
    resetOrderForm();
  };

  const launchARExperience = async (coffeeId) => {
    if (!siteSettings.showAR) {
      alert('AR is currently disabled by admin.');
      return;
    }

    const sharedData = globalThis.AR_SHARED_DATA || {};
    const fallbackMap = {
      1: 'coffee',
      2: 'latte',
      3: 'coffee',
      4: 'latte',
      5: 'latte',
      6: 'coffee',
      7: 'latte',
      8: 'coffee',
    };
    const coffeeToDishMap = sharedData.coffeeToDishMap || fallbackMap;
    const defaultDishId = sharedData.defaultDishId || 'coffee';
    const selectedDish = coffeeToDishMap[coffeeId] || defaultDishId;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported on this browser.');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch {
      alert('Camera permission is required to start AR.');
      return;
    }

    localStorage.setItem('selectedDish', selectedDish);
    globalThis.location.href = '/ar/ar.html';
  };

  return {
    isMobile,
    currentView,
    setCurrentView,
    menuOpen,
    setMenuOpen,
    scrolled,
    favorites,
    isDarkMode,
    siteSettings,
    cartItems,
    cartCount,
    cartTotal,
    tableNumber,
    setTableNumber,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    orderNotes,
    setOrderNotes,
    orderMsg,
    isSubmittingOrder,
    lastOrder,
    menuCoffeeItems,
    categories,
    toggleFavorite,
    clearAllFavorites,
    toggleTheme,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitOrder,
    launchARExperience,
  };
}
