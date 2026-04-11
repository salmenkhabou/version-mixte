export const ADMIN_STORAGE_KEYS = {
  settings: 'brew_site_settings',
  items: 'brew_coffee_items',
  session: 'brew_admin_session',
  lockUntil: 'brew_admin_lock_until',
};

export const DEFAULT_SITE_SETTINGS = {
  siteEnabled: true,
  showAR: true,
  showGames: true,
};

export function loadSiteSettings() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SITE_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SITE_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.error('Unable to load site settings:', error);
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

export function saveSiteSettings(settings) {
  try {
    const payload = {
      ...DEFAULT_SITE_SETTINGS,
      ...settings,
    };
    localStorage.setItem(ADMIN_STORAGE_KEYS.settings, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.error('Unable to save site settings:', error);
    return settings;
  }
}

export function loadCoffeeItems(fallback = []) {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.items);
    if (!raw) return Array.isArray(fallback) ? fallback : [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array.isArray(fallback) ? fallback : [];
    return parsed;
  } catch (error) {
    console.error('Unable to load coffee items:', error);
    return Array.isArray(fallback) ? fallback : [];
  }
}

export function saveCoffeeItems(items) {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEYS.items, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error('Unable to save coffee items:', error);
    return false;
  }
}
