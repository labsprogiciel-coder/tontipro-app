import { useEffect } from "react";
import { useTransactionStore } from "@/stores/transaction-store";

/**
 * Abonnement Realtime aux INSERT sur `transactions` pour l’agent connecté.
 * Déduplication avec l’état local gérée dans le store.
 */
export function useTransactionRealtimeSubscribe(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = useTransactionStore
      .getState()
      .subscribeToTransactionsRealtime(userId);
    return unsubscribe;
  }, [userId]);
}
