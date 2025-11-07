import NetInfo from "@react-native-community/netinfo";

/**
 * Checks if the device is currently connected to the internet
 * @returns Promise<boolean> True if connected, false otherwise
 */
export async function isConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}

/**
 * Subscribes to network state changes
 * @param onChange Callback function that receives the connection state
 * @returns Unsubscribe function
 */
export function subscribeToNetworkChanges(
  onChange: (isConnected: boolean) => void
): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(state.isConnected ?? false);
  });
}