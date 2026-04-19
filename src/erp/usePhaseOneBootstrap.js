import { useCallback, useEffect, useState } from 'react';
import { syncOfflineOrderQueue } from '../utils/orderService';
import { getOfflineQueueStats } from '../utils/offlineQueue';
import {
  publishServerNotification,
  showLocalNotification,
  subscribeToServerNotifications,
} from '../utils/notificationService';
import { ERP_ACTIONS } from './permissions';
import { useAccess } from '../contexts/AccessContext';

export function usePhaseOneBootstrap() {
  const { profile, role, activeBranchId, can } = useAccess();
  const [queueStats, setQueueStats] = useState(() => getOfflineQueueStats());
  const [lastSyncMessage, setLastSyncMessage] = useState('');
  const [lastPushMessage, setLastPushMessage] = useState('');

  const refreshQueueStats = useCallback(() => {
    setQueueStats(getOfflineQueueStats());
  }, []);

  const syncOfflineQueueNow = useCallback(async (silent = false) => {
    const result = await syncOfflineOrderQueue();
    refreshQueueStats();

    if (!silent) {
      setLastSyncMessage(result.message || 'Sync complete.');
    }

    return result;
  }, [refreshQueueStats]);

  const publishNotificationNow = useCallback(async ({
    title,
    body,
    payload,
    targetRole = 'all',
    targetUserId = null,
    branchId = null,
  } = {}) => {
    if (!can(ERP_ACTIONS.NOTIFICATIONS_PUBLISH)) {
      const denied = {
        ok: false,
        message: 'Permission refusee: publication notification non autorisee.',
      };
      setLastPushMessage(denied.message);
      return denied;
    }

    const result = await publishServerNotification({
      title,
      body,
      payload,
      targetRole,
      targetUserId,
      branchId: branchId || activeBranchId || null,
    });

    setLastPushMessage(result.ok ? 'Notification serveur publiee.' : `Erreur notification: ${result.message}`);
    return result;
  }, [can, activeBranchId]);

  useEffect(() => {
    const handleOnline = () => {
      void syncOfflineQueueNow(true);
    };

    const handleQueueUpdate = () => {
      refreshQueueStats();
    };

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('erp-offline-queue-updated', handleQueueUpdate);

    refreshQueueStats();
    if (globalThis.navigator?.onLine) {
      void syncOfflineQueueNow(true);
    }

    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('erp-offline-queue-updated', handleQueueUpdate);
    };
  }, [refreshQueueStats, syncOfflineQueueNow]);

  useEffect(() => {
    const subscription = subscribeToServerNotifications({
      role,
      userId: profile?.userId || null,
      branchId: activeBranchId,
      onNotification: (notification) => {
        setLastPushMessage(`Notif: ${notification.title}`);
        showLocalNotification(notification.title || 'ERP Notification', {
          body: notification.body || 'Nouvelle notification serveur.',
          data: notification.payload || {},
        });

        globalThis.dispatchEvent(new CustomEvent('erp-server-notification', {
          detail: notification,
        }));
      },
    });

    return () => {
      if (typeof subscription?.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [role, profile?.userId, activeBranchId]);

  return {
    queueStats,
    lastSyncMessage,
    lastPushMessage,
    syncOfflineQueueNow,
    publishNotificationNow,
  };
}
