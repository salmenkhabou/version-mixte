import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ERP_ACTIONS } from '../../erp/permissions';
import { useAccess } from '../../contexts/AccessContext';
import { syncOfflineOrderQueue } from '../../utils/orderService';
import {
  getNotificationPermissionState,
  publishServerNotification,
  registerPushDevice,
  requestNotificationPermission,
  showLocalNotification,
} from '../../utils/notificationService';
import { getOfflineQueueStats } from '../../utils/offlineQueue';

const BRANCH_FORM_DEFAULT = {
  id: '',
  code: '',
  name: '',
  timezone: 'Africa/Tunis',
};

export default function ErpControlCenter() {
  const {
    isReady,
    profile,
    role,
    permissions,
    branches,
    activeBranchId,
    activeBranch,
    switchBranch,
    createOrUpdateBranch,
    deleteBranch,
    can,
  } = useAccess();

  const [branchForm, setBranchForm] = useState(BRANCH_FORM_DEFAULT);
  const [branchMsg, setBranchMsg] = useState('');
  const [pushMsg, setPushMsg] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushTargetRole, setPushTargetRole] = useState('staff');
  const [pushTargetUserId, setPushTargetUserId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [queueStats, setQueueStats] = useState(() => getOfflineQueueStats());
  const [lastSyncMessage, setLastSyncMessage] = useState('');

  const canManageBranches = can(ERP_ACTIONS.BRANCH_MANAGE);
  const canSyncOffline = can(ERP_ACTIONS.OFFLINE_SYNC);
  const canManageNotifications = can(ERP_ACTIONS.NOTIFICATIONS_MANAGE);
  const canPublishNotifications = can(ERP_ACTIONS.NOTIFICATIONS_PUBLISH);

  const sortedPermissions = useMemo(
    () => [...permissions].sort((a, b) => a.localeCompare(b)),
    [permissions],
  );

  const notificationState = getNotificationPermissionState();

  useEffect(() => {
    const refreshQueueState = () => {
      setQueueStats(getOfflineQueueStats());
    };

    globalThis.addEventListener('erp-offline-queue-updated', refreshQueueState);
    refreshQueueState();

    return () => {
      globalThis.removeEventListener('erp-offline-queue-updated', refreshQueueState);
    };
  }, []);

  const handleBranchSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      id: branchForm.id.trim().toLowerCase(),
      code: branchForm.code.trim().toUpperCase() || branchForm.id.trim().toUpperCase(),
      name: branchForm.name.trim(),
      timezone: branchForm.timezone.trim() || 'Africa/Tunis',
      isActive: true,
    };

    if (!payload.id || !payload.name) {
      setBranchMsg('Branch ID and name are required.');
      return;
    }

    const ok = await createOrUpdateBranch(payload);
    if (!ok) {
      setBranchMsg('Branch save failed. Check your permissions.');
      return;
    }

    setBranchForm(BRANCH_FORM_DEFAULT);
    setBranchMsg('Branch saved successfully.');
  };

  const handleDeleteBranch = async (branchId) => {
    if (branchId === 'main') {
      setBranchMsg('Main branch cannot be deleted.');
      return;
    }

    const confirmed = globalThis.confirm('Delete this branch?');
    if (!confirmed) return;

    const ok = await deleteBranch(branchId);
    if (!ok) {
      setBranchMsg('Branch delete failed.');
      return;
    }

    setBranchMsg('Branch deleted.');
  };

  const handleEnablePush = async () => {
    const permission = await requestNotificationPermission();
    if (!permission.ok) {
      setPushMsg(permission.message);
      return;
    }

    const registration = await registerPushDevice({
      userId: profile.userId,
      role,
      branchId: activeBranchId,
    });

    setPushMsg(registration.message);
    showLocalNotification('Brew ERP', {
      body: 'Push base is ready on this device.',
    });
  };

  const handleSyncOfflineQueue = async () => {
    const result = await syncOfflineOrderQueue();
    setQueueStats(getOfflineQueueStats());
    setLastSyncMessage(result.message || 'Sync complete.');
    setSyncMsg(`${result.message} Synced: ${result.synced || 0}, failed: ${result.failed || 0}.`);
  };

  const handleSendServerPush = async () => {
    if (!canPublishNotifications) {
      setPushMsg('Permission refusee: publication push non autorisee.');
      return;
    }

    const safeTitle = pushTitle.trim();
    if (!safeTitle) {
      setPushMsg('Titre notification obligatoire.');
      return;
    }

    const result = await publishServerNotification({
      title: safeTitle,
      body: pushBody.trim(),
      targetRole: pushTargetRole,
      targetUserId: pushTargetUserId.trim() || null,
      branchId: activeBranchId,
      payload: {
        source: 'erp-control-center',
        author: profile.email || role,
      },
    });

    if (!result.ok) {
      setPushMsg(`Erreur publication push: ${result.message}`);
      return;
    }

    setPushMsg('Push serveur publie avec succes.');
    setPushTitle('');
    setPushBody('');
    setPushTargetUserId('');
  };

  if (!isReady) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-6'>
        <p className='text-sm text-white/70'>Loading ERP control center...</p>
      </div>
    );
  }

  if (!can(ERP_ACTIONS.ERP_CONTROL_VIEW)) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-6'>
        <div className='max-w-lg w-full border border-rose-500/30 bg-white/5 p-7 text-center'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-rose-400 mb-3'>Access Denied</p>
          <h1 className='text-2xl font-light mb-3'>ERP Control Center</h1>
          <p className='text-white/65 text-sm'>Your current role does not include ERP control permissions.</p>
          <Link
            to='/'
            className='inline-flex mt-5 px-4 py-2 border border-white/25 text-sm hover:bg-white/10 transition-colors'
          >
            Return to app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-black text-white px-4 sm:px-6 py-8'>
      <div className='max-w-6xl mx-auto space-y-6'>
        <header className='border border-amber-500/30 bg-white/5 p-6'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-2'>Phase 1</p>
          <h1 className='text-2xl sm:text-3xl font-light'>ERP Control Center</h1>
          <p className='text-sm text-white/65 mt-2'>
            Phone-first operations for branches, permissions, notifications, and offline sync.
          </p>
          <p className='text-xs text-white/60 mt-3'>
            Role: <span className='text-amber-400'>{role}</span> | User: {profile.email || 'guest'}
          </p>
        </header>

        <section className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <article className='border border-white/10 bg-white/5 p-5'>
            <h2 className='text-lg font-medium mb-3'>Branch Context</h2>
            <p className='text-sm text-white/70 mb-4'>
              Active branch: <span className='text-amber-400'>{activeBranch?.name || activeBranchId}</span>
            </p>

            <div className='space-y-2'>
              {branches.map((branch) => (
                <div key={branch.id} className='border border-white/10 p-3 flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-sm'>{branch.name}</p>
                    <p className='text-xs text-white/50'>{branch.code} | {branch.timezone}</p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => switchBranch(branch.id)}
                      className='px-3 py-1 text-xs border border-white/20 hover:bg-white/10 transition-colors'
                    >
                      {activeBranchId === branch.id ? 'Active' : 'Set Active'}
                    </button>
                    {canManageBranches && branch.id !== 'main' && (
                      <button
                        type='button'
                        onClick={() => {
                          void handleDeleteBranch(branch.id);
                        }}
                        className='px-3 py-1 text-xs border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition-colors'
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canManageBranches && (
              <form className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2' onSubmit={handleBranchSubmit}>
                <input
                  value={branchForm.id}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder='branch id (for example branch-sousse)'
                  className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <input
                  value={branchForm.code}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder='code (for example SSS)'
                  className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <input
                  value={branchForm.name}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder='branch name'
                  className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <input
                  value={branchForm.timezone}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  placeholder='timezone'
                  className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <button
                  type='submit'
                  className='sm:col-span-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors'
                >
                  Save Branch
                </button>
              </form>
            )}
            {branchMsg && <p className='mt-3 text-xs text-amber-300'>{branchMsg}</p>}
          </article>

          <article className='border border-white/10 bg-white/5 p-5'>
            <h2 className='text-lg font-medium mb-3'>Action Permissions</h2>
            <div className='flex flex-wrap gap-2'>
              {sortedPermissions.map((permission) => (
                <span
                  key={permission}
                  className='px-2 py-1 text-[11px] border border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                >
                  {permission}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <article className='border border-white/10 bg-white/5 p-5'>
            <h2 className='text-lg font-medium mb-2'>Offline Queue</h2>
            <p className='text-sm text-white/65'>
              Total: {queueStats.total} | Pending: {queueStats.pending} | Failed: {queueStats.failed}
            </p>
            {canSyncOffline ? (
              <button
                type='button'
                onClick={() => {
                  void handleSyncOfflineQueue();
                }}
                className='mt-3 px-4 py-2 border border-sky-500/40 text-sky-300 hover:bg-sky-500/15 transition-colors text-sm'
              >
                Sync Offline Queue
              </button>
            ) : (
              <p className='text-xs text-rose-300 mt-3'>No permission to trigger sync.</p>
            )}
            {syncMsg && <p className='mt-2 text-xs text-white/70'>{syncMsg}</p>}
            {lastSyncMessage && <p className='mt-1 text-xs text-amber-300'>{lastSyncMessage}</p>}
          </article>

          <article className='border border-white/10 bg-white/5 p-5'>
            <h2 className='text-lg font-medium mb-2'>Push Notifications</h2>
            <p className='text-sm text-white/65'>Permission: {notificationState}</p>
            {canManageNotifications ? (
              <button
                type='button'
                onClick={() => {
                  void handleEnablePush();
                }}
                className='mt-3 px-4 py-2 border border-amber-500/40 text-amber-300 hover:bg-amber-500/15 transition-colors text-sm'
              >
                Enable Push Base
              </button>
            ) : (
              <p className='text-xs text-rose-300 mt-3'>No permission to manage notifications.</p>
            )}

            {canPublishNotifications ? (
              <div className='mt-4 border-t border-white/10 pt-4 space-y-2'>
                <p className='text-xs text-white/60'>Server-driven push publication</p>
                <input
                  value={pushTitle}
                  onChange={(event) => setPushTitle(event.target.value)}
                  placeholder='Titre notification'
                  className='w-full bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <input
                  value={pushBody}
                  onChange={(event) => setPushBody(event.target.value)}
                  placeholder='Message (optionnel)'
                  className='w-full bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                />
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  <select
                    value={pushTargetRole}
                    onChange={(event) => setPushTargetRole(event.target.value)}
                    className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                  >
                    <option value='all' className='text-black'>all</option>
                    <option value='staff' className='text-black'>staff</option>
                    <option value='manager' className='text-black'>manager</option>
                    <option value='admin' className='text-black'>admin</option>
                    <option value='customer' className='text-black'>customer</option>
                  </select>
                  <input
                    value={pushTargetUserId}
                    onChange={(event) => setPushTargetUserId(event.target.value)}
                    placeholder='Target user id (optionnel)'
                    className='bg-transparent border border-white/20 px-3 py-2 text-sm outline-none focus:border-amber-500'
                  />
                </div>
                <button
                  type='button'
                  onClick={() => {
                    void handleSendServerPush();
                  }}
                  className='px-4 py-2 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 transition-colors text-sm'
                >
                  Publish Server Push
                </button>
              </div>
            ) : null}

            {pushMsg && <p className='mt-2 text-xs text-white/70'>{pushMsg}</p>}
          </article>
        </section>
      </div>
    </div>
  );
}
