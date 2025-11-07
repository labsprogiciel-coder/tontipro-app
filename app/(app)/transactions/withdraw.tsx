import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, User } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { Client } from "@/types/client";

export default function WithdrawalScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { clients, getClientById } = useClientStore();
  const { addTransaction } = useTransactionStore();
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (clientId) {
      const client = getClientById(clientId);
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [clientId, getClientById]);

  const handleWithdrawal = async () => {
    if (!selectedClient) {
      Alert.alert("Érreur", "Veuillez sélectionner un client");
      return;
    }

    if (!amount || parseInt(amount, 10) <= 0) {
      Alert.alert("Érreur", "Veuillez entrer un montant valide");
      return;
    }

    const withdrawalAmount = parseInt(amount, 10);
    
    if (withdrawalAmount > selectedClient.balance) {
      Alert.alert("Solde insuffisant", "Le montant du retrait dépasse le solde du client");
      return;
    }

    setIsLoading(true);

    try {
      await addTransaction({
        clientId: selectedClient.id,
        amount: withdrawalAmount,
        type: "withdrawal",
        notes: reason,
      });

      Alert.alert(
        "Succès",
        `Retrait de ${withdrawalAmount.toLocaleString()} FCFA traité pour ${selectedClient.name}`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Érreur", "Impossible de traiter le retrait. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Traiter le retrait</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            {!clientId && (
              <>
                <Text style={styles.sectionTitle}>Sélectionner un client</Text>
                <Pressable
                  style={styles.clientSelector}
                  onPress={() => setShowClientPicker(!showClientPicker)}
                >
                  <View style={styles.clientSelectorContent}>
                    {selectedClient ? (
                      <>
                        <View style={styles.avatarContainer}>
                          <User size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.selectedClientName}>
                          {selectedClient.name}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.placeholderText}>Sélectionner un client</Text>
                    )}
                  </View>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </Pressable>

                {showClientPicker && (
                  <View style={styles.clientPickerContainer}>
                    <ScrollView style={styles.clientList}>
                      {clients.map((client) => (
                        <Pressable
                          key={client.id}
                          style={styles.clientItem}
                          onPress={() => {
                            setSelectedClient(client);
                            setShowClientPicker(false);
                          }}
                        >
                          <View style={styles.avatarContainer}>
                            <User size={20} color={colors.primary} />
                          </View>
                          <View style={styles.clientInfo}>
                            <Text style={styles.clientName}>{client.name}</Text>
                            <Text style={styles.clientPhone}>{client.phone}</Text>
                          </View>
                          <Text style={styles.clientBalance}>
                            {client.balance.toLocaleString()} FCFA
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {selectedClient && (
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Solde disponible</Text>
                <Text style={styles.balanceAmount}>
                  {selectedClient.balance.toLocaleString()} FCFA
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Montant du retrait</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencyPrefix}>FCFA</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.sectionTitle}>Raison du retrait</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Entrer la raison du retrait"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleWithdrawal}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? "Traitement..." : "Traiter le retrait"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
    marginTop: 20,
  },
  clientSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  clientSelectorContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  selectedClientName: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  clientPickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    maxHeight: 200,
  },
  clientList: {
    padding: 8,
  },
  clientItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  clientPhone: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  clientBalance: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.secondary,
  },
  balanceInfo: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 60,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 60,
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
  },
  reasonInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 24,
    minHeight: 100,
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: colors.inactive,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});