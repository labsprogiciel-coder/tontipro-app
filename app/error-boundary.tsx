import React from "react";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { useNavigationStore } from "@/stores/navigation-store";
import { colors } from "@/constants/colors";
import { useRouter } from "expo-router";

import { SPACE } from "@/constants/spacing";
interface Props {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const IFRAME_ID = "rork-web-preview";

const webTargetOrigins = [
  "http://localhost:3000",
  "https://rorkai.com",
  "https://rork.app",
];

function sendErrorToIframeParent(error: any, errorInfo?: any) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    console.debug("Sending error to parent:", {
      error,
      errorInfo,
      referrer: document.referrer,
    });

    const errorMessage = {
      type: "ERROR",
      error: {
        message: error?.message || error?.toString() || "Unknown error",
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
      },
      iframeId: IFRAME_ID,
    };

    try {
      window.parent.postMessage(
        errorMessage,
        webTargetOrigins.includes(document.referrer) ? document.referrer : "*",
      );
    } catch (postMessageError) {
      console.error("Failed to send error to parent:", postMessageError);
    }
  }
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      event.preventDefault();
      const errorDetails = event.error ?? {
        message: event.message ?? "Unknown error",
        filename: event.filename ?? "Unknown file",
        lineno: event.lineno ?? "Unknown line",
        colno: event.colno ?? "Unknown column",
      };
      sendErrorToIframeParent(errorDetails);
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      event.preventDefault();
      sendErrorToIframeParent(event.reason);
    },
    true,
  );

  const originalConsoleError = console.error;
  console.error = (...args) => {
    sendErrorToIframeParent(args.join(" "));
    originalConsoleError.apply(console, args);
  };
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    sendErrorToIframeParent(error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Clear navigation state on error
    useNavigationStore.getState().clearNavigationState();
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error }: { error: Error | null }) {
  const router = useRouter();
  const clearNavigationState = useNavigationStore(
    (state) => state.clearNavigationState,
  );

  const handleReset = () => {
    clearNavigationState();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>{error?.message}</Text>
        {Platform.OS !== "web" && (
          <Text style={styles.description}>
            Please check your device logs for more details.
          </Text>
        )}

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Return to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl,
  },
  title: {
    fontSize: 36,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: SPACE.sm,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: SPACE.md,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  resetButton: {
    marginTop: SPACE.xl,
    backgroundColor: colors.primary,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xl,
    borderRadius: 8,
  },
  resetButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default ErrorBoundary;
