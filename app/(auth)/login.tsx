import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, User } from "lucide-react-native";

import { colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth-store";
import { MOCK_AGENTS } from "@/mocks/auth";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [agentId, setAgentId] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!agentId || !pin) {
      setError("Please enter your Agent ID and PIN");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // In a real app, this would validate credentials against an API
      await login(agentId, pin);
      router.replace("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>ÉpargneMobile</Text>
            <Text style={styles.tagline}>Agent Portal</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Log in to continue managing your clients
            </Text>

            <View style={styles.credentialsBox}>
              <Text style={styles.credentialsTitle}>Demo Credentials:</Text>
              {MOCK_AGENTS.map((agent) => (
                <Text key={agent.id} style={styles.credentialsText}>
                  {agent.id} / {agent.pin}
                </Text>
              ))}
            </View>

            <View style={styles.inputContainer}>
              <User size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Agent ID"
                value={agentId}
                onChangeText={setAgentId}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="PIN"
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? "Logging in..." : "Log In"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(auth)/register")}
              style={styles.registerLink}
            >
              <Text style={styles.registerText}>
                New agent? <Text style={styles.registerHighlight}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
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
  errorText: {
    color: colors.error,
    marginBottom: 16,
  },
  loginButton: {
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
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  registerLink: {
    marginTop: 24,
    alignItems: "center",
  },
  registerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  registerHighlight: {
    color: colors.primary,
    fontWeight: "600",
  },
  credentialsBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  credentialsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
  },
  credentialsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 2,
  },
});