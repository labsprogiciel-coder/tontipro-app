import { Pressable, View, Text, StyleSheet } from "react-native";

import { SPACE } from "@/constants/spacing";
interface SectionHeaderProps {
  title: string;
  linkText?: string;
  onLinkClick?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  linkText,
  onLinkClick,
}) => (
  <View style={styles.row}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {linkText && (
      <Pressable accessibilityRole="button" onPress={onLinkClick}>
        <Text style={styles.link}>{linkText} →</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6c6b65",
    textTransform: "uppercase",
  },
  link: { fontSize: 11, color: "#993C1D" },
});

export default SectionHeader;
