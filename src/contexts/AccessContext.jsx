import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ERP_ACTIONS,
  getPermissionsForRole,
  hasActionPermission,
  resolveRoleFromAccessProfile,
} from '../erp/permissions';
import {
  getActiveBranchId,
  loadBranches,
  removeBranch,
  setActiveBranchId,
  upsertBranch,
} from '../utils/branchService';
import { getServerAccessProfile } from '../utils/orderService';
import { supabaseClient } from '../lib/supabaseClient';

const DEFAULT_PROFILE = {
  ok: false,
  allowed: false,
  isStaff: false,
  isAdmin: false,
  isManager: false,
  role: 'guest',
  message: '',
  userId: null,
  email: null,
};

const AccessContext = createContext(null);

function createGuestProfile() {
  return { ...DEFAULT_PROFILE };
}

export function AccessProvider({ children }) {
  const [profile, setProfile] = useState(() => createGuestProfile());
  const [role, setRole] = useState('guest');
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchState] = useState(() => getActiveBranchId());
  const [isReady, setIsReady] = useState(false);

  const refreshAccess = useCallback(async () => {
    const [accessProfile, loadedBranches] = await Promise.all([
      getServerAccessProfile(),
      loadBranches(),
    ]);

    const nextProfile = accessProfile?.ok ? accessProfile : createGuestProfile();
    const nextRole = resolveRoleFromAccessProfile(nextProfile);

    setProfile(nextProfile);
    setRole(nextRole);
    setBranches(Array.isArray(loadedBranches) ? loadedBranches : []);
    setActiveBranchState(getActiveBranchId());
    setIsReady(true);
  }, []);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    if (!supabaseClient) return undefined;

    const { data } = supabaseClient.auth.onAuthStateChange(() => {
      void refreshAccess();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refreshAccess]);

  useEffect(() => {
    const syncBranchState = () => {
      setActiveBranchState(getActiveBranchId());
      void loadBranches().then((nextBranches) => {
        setBranches(Array.isArray(nextBranches) ? nextBranches : []);
      });
    };

    globalThis.addEventListener('storage', syncBranchState);
    globalThis.addEventListener('erp-branches-updated', syncBranchState);

    return () => {
      globalThis.removeEventListener('storage', syncBranchState);
      globalThis.removeEventListener('erp-branches-updated', syncBranchState);
    };
  }, []);

  const switchBranch = useCallback((branchId) => {
    const ok = setActiveBranchId(branchId);
    if (ok) {
      setActiveBranchState(getActiveBranchId());
    }
    return ok;
  }, []);

  const can = useCallback(
    (action) => hasActionPermission(role, action),
    [role],
  );

  const createOrUpdateBranch = useCallback(async (branch) => {
    if (!can(ERP_ACTIONS.BRANCH_MANAGE)) return false;

    const ok = await upsertBranch(branch);
    if (!ok) return false;

    const nextBranches = await loadBranches();
    setBranches(Array.isArray(nextBranches) ? nextBranches : []);
    setActiveBranchState(getActiveBranchId());
    return true;
  }, [can]);

  const deleteBranch = useCallback(async (branchId) => {
    if (!can(ERP_ACTIONS.BRANCH_MANAGE)) return false;

    const ok = await removeBranch(branchId);
    if (!ok) return false;

    const nextBranches = await loadBranches();
    setBranches(Array.isArray(nextBranches) ? nextBranches : []);
    setActiveBranchState(getActiveBranchId());
    return true;
  }, [can]);

  const permissions = useMemo(() => getPermissionsForRole(role), [role]);

  const value = useMemo(() => ({
    isReady,
    profile,
    role,
    permissions,
    branches,
    activeBranchId,
    activeBranch: branches.find((branch) => branch.id === activeBranchId) || null,
    refreshAccess,
    switchBranch,
    createOrUpdateBranch,
    deleteBranch,
    can,
  }), [
    isReady,
    profile,
    role,
    permissions,
    branches,
    activeBranchId,
    refreshAccess,
    switchBranch,
    createOrUpdateBranch,
    deleteBranch,
    can,
  ]);

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

AccessProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
}
