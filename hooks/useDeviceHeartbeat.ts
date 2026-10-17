// hooks/useDeviceHeartbeat.ts
//
// While the app is open on a bound TPE, tell the server it's alive and how
// it's doing (admin convex/devices.ts heartbeat): at start, every 15 minutes,
// and whenever the app comes back to the foreground. The dashboard shows
// "En ligne / Hors ligne", battery, network and unsynced operations from it.
// Failures are ignored: the next check-in tries again.
import { useEffect } from "react";
import { AppState } from "react-native";
import { useConvexAuth, useMutation } from "convex/react";
import NetInfo from "@react-native-community/netinfo";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as Updates from "expo-updates";
import { deviceHeartbeat } from "@/lib/admin-api";
import { useAuthStore } from "@/stores/auth-store";
import { useTransactionStore } from "@/stores/transaction-store";

const INTERVAL_MS = 15 * 60 * 1000;
// Coming back to the foreground more often than this doesn't re-report
const MIN_GAP_MS = 60 * 1000;

type Network = "wifi" | "cellular" | "none" | "other";

/** Battery, network and app details as the heartbeat sends them; unknown values are left out. */
async function readStatus() {
  const [level, state, net] = await Promise.all([
    Battery.getBatteryLevelAsync().catch(() => -1),
    Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
    NetInfo.fetch().catch(() => null),
  ]);
  const network: Network | undefined = !net
    ? undefined
    : net.isConnected === false
      ? "none"
      : net.type === "wifi"
        ? "wifi"
        : net.type === "cellular"
          ? "cellular"
          : "other";
  return {
    appVersion: `${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"})`,
    updateId: Updates.updateId ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    battery: level >= 0 ? level : undefined,
    charging:
      state === Battery.BatteryState.UNKNOWN
        ? undefined
        : state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    network,
    pendingOps: useTransactionStore.getState().pendingTransactions.length,
  };
}

export function useDeviceHeartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const serialNumber = useAuthStore((s) => s.user?.device?.serialNumber as string | undefined);
  const beat = useMutation(deviceHeartbeat);

  useEffect(() => {
    if (!isAuthenticated || !serialNumber) return;
    let last = 0;
    const send = async () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      try {
        await beat({ serialNumber, ...(await readStatus()) });
      } catch {
        // offline or server unreachable: the next check-in will retry
      }
    };

    send();
    const timer = setInterval(send, INTERVAL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") send();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isAuthenticated, serialNumber, beat]);
}
