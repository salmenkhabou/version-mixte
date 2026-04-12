import { supabaseClient } from '../lib/supabaseClient';

export const ADMIN_STORAGE_KEYS = {
  settings: 'brew_site_settings',
  items: 'brew_coffee_items',
  session: 'brew_admin_session',
  lockUntil: 'brew_admin_lock_until',
};

const REMOTE_TABLE = 'app_state';
const REMOTE_ROW_ID = 'global';

export const DEFAULT_SITE_SETTINGS = {
  siteEnabled: true,
  showAR: true,
  showGames: true,
  showOrdersModule: true,
};

function emitAdminStorageUpdate(key) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('admin-storage-updated', { detail: { key } }));
}

function readJsonFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Unable to read localStorage key "${key}":`, error);
    return null;
  }
}

function writeJsonToStorage(key, value, shouldEmit = true) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (shouldEmit) emitAdminStorageUpdate(key);
    return true;
  } catch (error) {
    console.error(`Unable to write localStorage key "${key}":`, error);
    return false;
  }
}

function normalizeSettings(value) {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(value && typeof value === 'object' ? value : {}),
  };
}

async function readRemoteState() {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from(REMOTE_TABLE)
      .select('settings, items')
      .eq('id', REMOTE_ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('Unable to read Supabase app_state. Falling back to local storage.', error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn('Supabase read failed. Falling back to local storage.', error);
    return null;
  }
}

async function upsertRemoteState(patch) {
  if (!supabaseClient) return false;

  try {
    const payload = {
      id: REMOTE_ROW_ID,
      updated_at: new Date().toISOString(),
      ...patch,
    };

    const { error } = await supabaseClient
      .from(REMOTE_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Unable to save to Supabase app_state. Local data is still saved.', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Supabase upsert failed. Local data is still saved.', error);
    return false;
  }
}

async function hasAuthenticatedSession() {
  if (!supabaseClient) return false;

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return false;
    return Boolean(data.session);
  } catch (error) {
    console.warn('Unable to verify Supabase auth session.', error);
    return false;
  }
}

export async function hasAdminWriteAccess() {
  if (!supabaseClient) return false;

  try {
    const { data, error } = await supabaseClient.rpc('is_admin');
    if (error) return false;
    return Boolean(data);
  } catch (error) {
    console.warn('Unable to verify admin write access.', error);
    return false;
  }
}

export async function loadSiteSettings() {
  const localSettings = normalizeSettings(readJsonFromStorage(ADMIN_STORAGE_KEYS.settings));
  const remoteState = await readRemoteState();

  if (remoteState?.settings && typeof remoteState.settings === 'object') {
    const merged = normalizeSettings(remoteState.settings);
    writeJsonToStorage(ADMIN_STORAGE_KEYS.settings, merged, false);
    return merged;
  }

  if (!remoteState?.settings) {
    void upsertRemoteState({ settings: localSettings });
  }

  return localSettings;
}

export async function saveSiteSettings(settings) {
  const payload = normalizeSettings(settings);
  const canWrite = await hasAuthenticatedSession();
  if (!canWrite) {
    throw new Error('Admin authentication required for settings update.');
  }

  const isAdmin = await hasAdminWriteAccess();
  if (!isAdmin) {
    throw new Error('Current user is not in public.admin_users.');
  }

  const remoteSaved = await upsertRemoteState({ settings: payload });
  if (!remoteSaved) {
    throw new Error('Unable to save settings to Supabase.');
  }

  writeJsonToStorage(ADMIN_STORAGE_KEYS.settings, payload);
  return payload;
}

export async function loadCoffeeItems(fallback = []) {
  const safeFallback = Array.isArray(fallback) ? fallback : [];
  const localItems = readJsonFromStorage(ADMIN_STORAGE_KEYS.items);
  const normalizedLocal = Array.isArray(localItems) ? localItems : safeFallback;

  const remoteState = await readRemoteState();
  if (Array.isArray(remoteState?.items)) {
    writeJsonToStorage(ADMIN_STORAGE_KEYS.items, remoteState.items, false);
    return remoteState.items;
  }

  if (!Array.isArray(remoteState?.items) && normalizedLocal.length > 0) {
    void upsertRemoteState({ items: normalizedLocal });
  }

  return normalizedLocal;
}

export async function saveCoffeeItems(items) {
  const payload = Array.isArray(items) ? items : [];
  const canWrite = await hasAuthenticatedSession();
  if (!canWrite) {
    return false;
  }

  const isAdmin = await hasAdminWriteAccess();
  if (!isAdmin) {
    return false;
  }

  const remoteSaved = await upsertRemoteState({ items: payload });
  if (!remoteSaved) return false;

  const localSaved = writeJsonToStorage(ADMIN_STORAGE_KEYS.items, payload);
  if (!localSaved) return false;

  return remoteSaved;
}
