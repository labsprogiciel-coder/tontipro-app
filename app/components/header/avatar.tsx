import { View, Text, StyleSheet, Pressable } from "react-native";

const HeaderAvatar: React.FC<{ initials: string; onPress?: () => void }> = ({
  initials,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
  >
    <Text style={styles.avatarText}>{initials}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)", // Semi-transparent overlay
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.7,
  },
});

export default HeaderAvatar;
