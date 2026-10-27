import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SPACE } from "@/constants/spacing";
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Page introuvable" }} />
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>Cette page n&apos;existe pas.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Retour à l&apos;accueil</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
