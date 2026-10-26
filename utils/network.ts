import NetInfo from "@react-native-community/netinfo";

/**
 * Checks if the device is currently connected to the internet
 * @returns Promise<boolean> True if connected, false otherwise
 */
export async function isConnected(): Promise<boolean> {
  return hasInternet(await NetInfo.fetch());
}

/**
 * Connected to a network that reaches the internet. A Wi-Fi with no internet
 * (or a SIM without data) reports isConnected but isInternetReachable false;
 * null means "not checked yet" and counts as online.
 */
function hasInternet(state: { isConnected: boolean | null; isInternetReachable?: boolean | null }) {
  return (state.isConnected ?? false) && state.isInternetReachable !== false;
}

/**
 * Subscribes to network state changes
 * @param onChange Callback function that receives the connection state
 * @returns Unsubscribe function
 */
export function subscribeToNetworkChanges(
  onChange: (isConnected: boolean) => void,
): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(hasInternet(state));
  });
}
