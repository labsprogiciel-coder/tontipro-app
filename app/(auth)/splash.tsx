import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";

// Pur écran d'attente — aucune logique de redirection ici. Le guard central
// dans app/_layout.tsx (RootLayoutNav) décide de la destination (welcome,
// change-password, bind-device ou dashboard) une fois l'état d'auth connu ;
// un second useEffect ici court-circuitait ce guard (il envoyait tout droit
// vers /dashboard sans vérifier mustChangePassword/device) et empêchait
// l'écran welcome de s'afficher au lancement de l'app.
export default function AuthSplash() {
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
