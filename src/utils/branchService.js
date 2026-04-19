import { supabaseClient } from '../lib/supabaseClient';

const BRANCH_TABLE = 'erp_branches';
const BRANCHES_STORAGE_KEY = 'erp_branches_v1';
const ACTIVE_BRANCH_STORAGE_KEY = 'erp_active_branch_id';

export const DEFAULT_BRANCHES = [
  {
    id: 'main',
    code: 'MAIN',
    name: 'Main Branch',
    timezone: 'Africa/Tunis',
    isActive: true,
  },
];

function emitBranchUpdate() {
  globalThis.dispatchEvent(new CustomEvent('erp-branches-updated'));
}

function normalizeBranch(branch, index = 0) {
  const fallbackId = `branch-${index + 1}`;
  const rawName = String(branch?.name || '').trim();
  const name = rawName || `Branch ${index + 1}`;
  const id = String(branch?.id || branch?.code || fallbackId).trim().toLowerCase();

  return {
    id,
    code: String(branch?.code || id).trim().toUpperCase(),
    name,
    timezone: String(branch?.timezone || 'Africa/Tunis').trim(),
    isActive: branch?.isActive !== false,
  };
}

function normalizeBranches(branches) {
  const safe = Array.isArray(branches) ? branches : [];
  const normalized = safe.map((branch, index) => normalizeBranch(branch, index));
  return normalized.length > 0 ? normalized : DEFAULT_BRANCHES.map((branch) => ({ ...branch }));
}

function readLocalBranches() {
  try {
    const raw = globalThis.localStorage?.getItem(BRANCHES_STORAGE_KEY);
    if (!raw) return DEFAULT_BRANCHES.map((branch) => ({ ...branch }));
    return normalizeBranches(JSON.parse(raw));
  } catch (error) {
    console.warn('Unable to read branch storage. Using defaults.', error);
    return DEFAULT_BRANCHES.map((branch) => ({ ...branch }));
  }
}

function writeLocalBranches(branches) {
  try {
    globalThis.localStorage?.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(normalizeBranches(branches)));
    emitBranchUpdate();
    return true;
  } catch (error) {
    console.warn('Unable to write branch storage.', error);
    return false;
  }
}

export function getActiveBranchId() {
  const branchId = String(globalThis.localStorage?.getItem(ACTIVE_BRANCH_STORAGE_KEY) || '').trim();
  if (branchId) return branchId;

  const [firstBranch] = readLocalBranches();
  return firstBranch?.id || DEFAULT_BRANCHES[0].id;
}

export function setActiveBranchId(branchId) {
  const normalized = String(branchId || '').trim();
  if (!normalized) return false;

  try {
    globalThis.localStorage?.setItem(ACTIVE_BRANCH_STORAGE_KEY, normalized);
    emitBranchUpdate();
    return true;
  } catch (error) {
    console.warn('Unable to persist active branch.', error);
    return false;
  }
}

function ensureValidActiveBranch(branches) {
  const safeBranches = normalizeBranches(branches);
  const current = getActiveBranchId();
  const exists = safeBranches.some((branch) => branch.id === current);
  if (exists) return current;

  const fallback = safeBranches[0]?.id || DEFAULT_BRANCHES[0].id;
  setActiveBranchId(fallback);
  return fallback;
}

async function readRemoteBranches() {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from(BRANCH_TABLE)
      .select('id, code, name, timezone, is_active')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Remote branch read failed. Falling back to local branches.', error.message);
      return null;
    }

    return (Array.isArray(data) ? data : []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
      isActive: row.is_active,
    }));
  } catch (error) {
    console.warn('Remote branch read threw. Falling back to local branches.', error);
    return null;
  }
}

async function upsertRemoteBranches(branches) {
  if (!supabaseClient) return false;

  try {
    const payload = normalizeBranches(branches).map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      timezone: branch.timezone,
      is_active: branch.isActive,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseClient
      .from(BRANCH_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Remote branch upsert failed. Keeping local branches.', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Remote branch upsert threw. Keeping local branches.', error);
    return false;
  }
}

export async function loadBranches() {
  const localBranches = readLocalBranches();
  const remoteBranches = await readRemoteBranches();

  if (Array.isArray(remoteBranches) && remoteBranches.length > 0) {
    const normalized = normalizeBranches(remoteBranches);
    writeLocalBranches(normalized);
    ensureValidActiveBranch(normalized);
    return normalized;
  }

  ensureValidActiveBranch(localBranches);
  return localBranches;
}

export async function saveBranches(branches) {
  const normalized = normalizeBranches(branches);
  const localSaved = writeLocalBranches(normalized);
  if (!localSaved) return false;

  void upsertRemoteBranches(normalized);
  ensureValidActiveBranch(normalized);
  return true;
}

export async function upsertBranch(branch) {
  const branches = await loadBranches();
  const normalized = normalizeBranch(branch, branches.length);

  const next = branches.some((item) => item.id === normalized.id)
    ? branches.map((item) => (item.id === normalized.id ? normalized : item))
    : [...branches, normalized];

  return saveBranches(next);
}

export async function removeBranch(branchId) {
  const normalized = String(branchId || '').trim();
  if (!normalized) return false;

  const branches = await loadBranches();
  const filtered = branches.filter((branch) => branch.id !== normalized);
  return saveBranches(filtered.length > 0 ? filtered : DEFAULT_BRANCHES);
}
