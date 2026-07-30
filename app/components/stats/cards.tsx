import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LucideIcon } from "lucide-react-native";

interface MetricPillProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  icon?: LucideIcon; // Accepts a Lucide icon component
}

const MetricPill: React.FC<MetricPillProps> = ({
  label,
  value,
  unit,
  trend,
  icon: Icon,
}) => (
  <View style={styles.pill}>
    <View style={styles.headerRow}>
      <Text style={styles.label}>{label}</Text>
      {Icon && (
        <Icon size={12} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
      )}
    </View>

    <Text style={styles.value}>{value}</Text>

    <View style={styles.footerRow}>
      {unit && <Text style={styles.subText}>{unit}</Text>}
      {trend && <Text style={[styles.subText, styles.trendText]}>{trend}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "rgba(255,255,255,0.18)", // --color-background-info/warning glass effect
    borderRadius: 12,
    padding: 10,
    flex: 1,
    minHeight: 80,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  subText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  trendText: {
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
});

export default MetricPill;
