// lib/withAuthRetry.ts

// `signIn()` (et plus généralement `ConvexReactClient.setAuth()`) résout côté
// client avant que le token ne soit propagé au transport Convex — le tout
// premier appel authentifié qui suit peut donc échouer avec "Non
// authentifié"/"Unauthenticated" alors que la session est en réalité valide.
// On retente brièvement plutôt que de remonter ça comme une vraie erreur.
export async function withAuthRetry<T>(
  fn: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isLastAttempt = i === attempts - 1;
      const message = String(e?.message ?? "");
      const isAuthRace =
        message.includes("Non authentifié") || message.includes("Unauthenticated");
      if (isLastAttempt || !isAuthRace) {
        throw e;
      }
      if (__DEV__) {
        console.log(`[withAuthRetry] tentative ${i + 1}/${attempts} échouée (${message}), nouvel essai...`);
      }
      // Backoff croissant : la propagation du token vers le transport Convex
      // peut prendre plus que quelques centaines de ms sur un réseau lent.
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}
