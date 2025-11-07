import { useState } from "react";
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
import { useRouter } from "expo-router";
import { ChevronLeft, User, Phone, Calendar, MapPin } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useClientStore } from "@/stores/client-store";

export default function AddClientScreen() {
  const router = useRouter();
  const { addClient } = useClientStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAddClient = async () => {
    if (!name || !phone) {
      Alert.alert("Missing Information", "Please enter client name and phone number");
      return;
    }

    setIsLoading(true);

    try {
      const deposit = initialDeposit ? parseInt(initialDeposit, 10) : 0;
      
      await addClient({
        name,
        phone,
        address,
        initialDeposit: deposit,
      });

      Alert.alert(
        "Client Added",
        `${name} has been successfully registered`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add client. Please try again.");
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
        <Text style={styles.headerTitle}>Add New Client</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Client Information</Text>

            <View style={styles.inputContainer}>
              <User size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Phone size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <MapPin size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Address (Optional)"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <Text style={styles.sectionTitle}>Initial Deposit</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>FCFA</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={initialDeposit}
                onChangeText={setInitialDeposit}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.infoText}>
              You can add an initial deposit or leave it empty
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleAddClient}
              disabled={isLoading}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? "Adding..." : "Add Client"}
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
  },
  input: {
    flex: 1,
    height: 50,
    marginLeft: 8,
    color: colors.text,
  },
  currencyPrefix: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: colors.inactive,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});