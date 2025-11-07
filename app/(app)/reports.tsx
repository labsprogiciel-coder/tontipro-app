import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, Calendar, Download } from "lucide-react-native";

import { colors } from "@/constants/colors";

export default function ReportsScreen() {
  const [period, setPeriod] = useState("week"); // week, month, year

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Performance Overview</Text>
          <View style={styles.periodSelector}>
            <Pressable
              style={[
                styles.periodButton,
                period === "week" && styles.periodButtonActive,
              ]}
              onPress={() => setPeriod("week")}
            >
              <Text
                style={[
                  styles.periodText,
                  period === "week" && styles.periodTextActive,
                ]}
              >
                Week
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.periodButton,
                period === "month" && styles.periodButtonActive,
              ]}
              onPress={() => setPeriod("month")}
            >
              <Text
                style={[
                  styles.periodText,
                  period === "month" && styles.periodTextActive,
                ]}
              >
                Month
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.periodButton,
                period === "year" && styles.periodButtonActive,
              ]}
              onPress={() => setPeriod("year")}
            >
              <Text
                style={[
                  styles.periodText,
                  period === "year" && styles.periodTextActive,
                ]}
              >
                Year
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <BarChart3 size={20} color={colors.primary} />
              <Text style={styles.chartTitle}>Collections</Text>
            </View>
            <View style={styles.dateContainer}>
              <Calendar size={16} color={colors.textSecondary} />
              <Text style={styles.dateText}>
                {period === "week"
                  ? "This Week"
                  : period === "month"
                  ? "This Month"
                  : "This Year"}
              </Text>
            </View>
          </View>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>Chart Visualization</Text>
          </View>
          <View style={styles.chartStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Collected</Text>
              <Text style={styles.statValue}>125,000 FCFA</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Target</Text>
              <Text style={styles.statValue}>200,000 FCFA</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Progress</Text>
              <Text style={styles.statValue}>62.5%</Text>
            </View>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Clients</Text>
              <Text style={styles.summaryValue}>42</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Active Clients</Text>
              <Text style={styles.summaryValue}>38</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>New Clients</Text>
              <Text style={styles.summaryValue}>5</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Transactions</Text>
              <Text style={styles.summaryValue}>156</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Commission Earned</Text>
              <Text style={styles.summaryValue}>12,500 FCFA</Text>
            </View>
          </View>
        </View>

        <View style={styles.exportSection}>
          <Pressable style={styles.exportButton}>
            <Download size={20} color="white" />
            <Text style={styles.exportText}>Export Report</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  periodTextActive: {
    color: "white",
  },
  chartCard: {
    margin: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: colors.background,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  chartPlaceholderText: {
    color: colors.textSecondary,
  },
  chartStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  summarySection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  exportSection: {
    padding: 20,
    paddingTop: 0,
    marginBottom: 20,
  },
  exportButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  exportText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});