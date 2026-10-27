import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

import { ArrowDown, ArrowUp, UserPlus } from "lucide-react-native";
import ClientCard from "../clients/clients";
import SearchInput from "../quickactions/search-input";

import { SPACE } from "@/constants/spacing";
const StartTransaction = () => {
  const [searchId, setSearchId] = useState("");
  const [foundClient, setFoundClient] = useState<any>(null);

  // Mock search logic - in production, this filters your ClientStore
  const handleSearch = (val: string) => {
    setSearchId(val);
    if (val === "123456") {
      // Example ID match
      setFoundClient({
        name: "Ibrahim Traoré",
        phone: "+226 76 45 67 89",
        amount: "120 500 F",
        status: "Actif",
        initials: "IT",
      });
    } else {
      setFoundClient(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Nouvelle Opération</Text>
        <Text style={styles.subtitle}>
          Saisissez l&apos;ID du client pour commencer
        </Text>
      </View>

      <View style={styles.body}>
        <SearchInput
          placeholder="Entrez l'ID Client (ex: 123456)"
          value={searchId}
          onChangeText={handleSearch}
        />

        {foundClient ? (
          <View style={styles.resultSection}>
            <Text style={styles.sectionLabel}>Client trouvé</Text>
            <ClientCard {...foundClient} avatarVariant="success" />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <UserPlus size={48} color="#6c6b65" strokeWidth={1} />
            <Text style={styles.emptyText}>Aucun client sélectionné</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eeede8" },
  header: { padding: SPACE.xl, paddingTop: SPACE.xxxl, backgroundColor: "#BB4721" },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: SPACE.xs },
  body: { padding: SPACE.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6c6b65",
    textTransform: "uppercase",
    marginBottom: SPACE.md,
  },
  resultSection: { marginTop: SPACE.sm },
  actionRow: { flexDirection: "row", gap: SPACE.md, marginTop: SPACE.lg },
  emptyState: { alignItems: "center", marginTop: SPACE.huge },
  emptyText: { marginTop: SPACE.md, color: "#6c6b65", fontSize: 14 },
});

export default StartTransaction;
