import { View, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

import { SPACE } from "@/constants/spacing";
const NotificationBell: React.FC<{ hasNotifications?: boolean }> = ({
  hasNotifications,
}) => (
  // No action yet: announced as a status, not a button
  <Pressable
    style={styles.container}
    accessible
    accessibilityLabel={
      hasNotifications ? "Nouvelles notifications" : "Aucune notification"
    }
  >
    <Svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.5a3.5 3.5 0 00-3.5 3.5v3.67L3.33 11h9.34L11.5 8.67V5a3.5 3.5 0 00-3.5-3.5zM6.5 12.5a1.5 1.5 0 003 0h-3z"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    {hasNotifications && <View style={styles.badge} />}
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    padding: SPACE.xs,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#993C1D", // Specific badge color from design
    borderWidth: 1,
    borderColor: "#D85A30", // Matches header background
  },
});

export default NotificationBell;
