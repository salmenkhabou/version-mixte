import { useEffect } from 'react';
import { getPublicOrderStatus } from '../../utils/orderService';

export function useLastOrderStatusPolling(lastOrder, setLastOrder, intervalMs = 6000) {
  useEffect(() => {
    if (!lastOrder?.orderNumber || !lastOrder?.tableNumber) return;

    let cancelled = false;

    const pullStatus = async () => {
      const statusResult = await getPublicOrderStatus(lastOrder.orderNumber, lastOrder.tableNumber);
      if (!statusResult.ok || cancelled) return;

      setLastOrder((prev) => {
        if (!prev || prev.orderNumber !== statusResult.orderNumber) return prev;
        return {
          ...prev,
          status: statusResult.status,
          updatedAt: statusResult.updatedAt,
          createdAt: statusResult.createdAt,
        };
      });
    };

    void pullStatus();
    const timer = globalThis.setInterval(() => {
      void pullStatus();
    }, intervalMs);

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [intervalMs, lastOrder?.orderNumber, lastOrder?.tableNumber, setLastOrder]);
}
