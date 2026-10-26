import { useEffect, useRef } from "react";
import { subscribeToNetworkChanges } from "@/utils/network";
import { useTransactionStore } from "@/stores/transaction-store";
import { useClientStore } from "@/stores/client-store";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Hook qui écoute les changements réseau et déclenche la sync
 * automatiquement quand l'appareil repasse en ligne.
 * - Debounce : la sync ne se déclenche qu'une fois par reconnexion
 * - Non bloquant : la sync tourne en arrière-plan
 * - Silencieux : les erreurs sont loggées, pas propagées
 */
export function useNetworkSync() {
  // Starts "offline" so the first online event (app start, sign-in) also
  // sends what was queued before the app was closed
  const wasOfflineRef = useRef(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((isConnected) => {
      if (!isConnected) {
        // Appareil hors ligne — on note l'état
        wasOfflineRef.current = true;
        return;
      }

      // Appareil en ligne
      if (!wasOfflineRef.current) return; // Pas de transition hors ligne → en ligne

      // ✅ Debounce — évite de déclencher plusieurs fois rapidement
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        wasOfflineRef.current = false;

        // ✅ Sync non bloquante en arrière-plan
        const syncAll = async () => {
          try {
            const syncTransactions =
              useTransactionStore.getState().syncPendingTransactions;
            const syncClients = useClientStore.getState().syncPendingClients;
            const branchId = useAuthStore.getState().user?.branchId;

            // Clients d'abord (FK `transactions.client_id`), puis transactions + soldes serveur
            await syncClients();
            if (branchId) {
              await syncTransactions(branchId);
            }
          } catch (error) {
            // ✅ Erreur silencieuse — l'app ne plante pas
            console.error("Network sync error:", error);
          }
        };

        syncAll();
      }, 1000); // Debounce de 1 seconde
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
}
