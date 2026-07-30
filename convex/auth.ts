// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { normalizePhoneNumber } from "./phone";

// Le champ interne `email` de @convex-dev/auth sert ici de simple clé de
// compte unique — on y stocke le numéro de téléphone de l'agent, qui est
// l'identifiant de connexion réel côté mobile (voir users.ts:checkLoginEligibility).
// Normalisé ici pour que "+22670000000", "22670000000", "0022670000000" et
// "70000000" pointent tous vers le même compte, au signUp comme au signIn.
const CustomPassword = Password({
  profile(params) {
    return {
      email: normalizePhoneNumber(params.phoneNumber as string),
    };
  },
  // Le provider valide par défaut un minimum de 8 caractères, ce qui rejette
  // les codes à 4 chiffres utilisés ici (code d'activation à la première
  // connexion comme mot de passe permanent choisi ensuite) — voir
  // convex/otp.ts pour le format du code d'activation.
  validatePasswordRequirements(password: string) {
    if (!/^\d{4,}$/.test(password)) {
      throw new Error("Invalid password");
    }
  },
});

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [CustomPassword],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const { existingUserId, profile } = args;

      // Si un user existe déjà (deuxième connexion), on le retourne
      if (existingUserId) {
        return existingUserId;
      }

      // Première connexion : chercher le user existant créé par l'admin
      // (ctx ici est typé GenericMutationCtx<AnyDataModel> par @convex-dev/auth,
      // donc withIndex() n'est pas disponible — filter() comme avant le fix)
      const existingUser = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("phoneNumber"), profile.email))
        .first();

      if (existingUser) {
        return existingUser._id;
      }

      // Ne devrait jamais arriver (checkActivationCode a déjà validé le numéro)
      throw new Error("Aucun compte trouvé pour ce numéro");
    },
  },
});
