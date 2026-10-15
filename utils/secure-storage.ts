import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Code PIN de déverrouillage local (4 chiffres), choisi par l'agent après sa
// connexion avec téléphone + mot de passe (app/(auth)/set-pin.tsx). Il ne
// sert jamais à se connecter au serveur : il ouvre seulement, à chaque
// lancement de l'app, la session Convex déjà présente sur l'appareil.
//
// Paliers de verrouillage après des codes erronés répétés.
const LOGIN_LOCKOUT_TIERS: { attempts: number; lockoutMs: number }[] = [
  { attempts: 5, lockoutMs: 5 * 60 * 1000 }, // 5 min
  { attempts: 10, lockoutMs: 30 * 60 * 1000 }, // 30 min
  { attempts: 15, lockoutMs: 2 * 60 * 60 * 1000 }, // 2h
  { attempts: 20, lockoutMs: 24 * 60 * 60 * 1000 }, // 24h (palier max, réappliqué au-delà)
];

function computeLockoutMs(attempts: number): number | null {
  let lockoutMs: number | null = null;
  for (const tier of LOGIN_LOCKOUT_TIERS) {
    if (attempts >= tier.attempts) lockoutMs = tier.lockoutMs;
  }
  return lockoutMs;
}

// SecureStore key: alphanumeric, ".", "-" and "_" only (see
// expo-secure-store's `isValidKey`) — un numéro normalisé E.164 commence par
// "+", que ce regex rejette. `setItemAsync` throw alors silencieusement pour
// tout appelant qui ne s'y attend pas (ex. changePassword() n'atteignait
// jamais son `router.replace` après un changement de mot de passe pourtant
// réussi côté serveur, car cet appel échouait juste avant).
function sanitizeKey(phoneNumber: string) {
  return phoneNumber.replace(/[^\w.-]/g, "");
}

function credentialKey(phoneNumber: string) {
  return `offline_cred_${sanitizeKey(phoneNumber)}`;
}
function attemptsKey(phoneNumber: string) {
  return `offline_attempts_${sanitizeKey(phoneNumber)}`;
}
function lockedUntilKey(phoneNumber: string) {
  return `offline_locked_until_${sanitizeKey(phoneNumber)}`;
}

async function hashCode(phoneNumber: string, code: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${phoneNumber}:${code}`,
  );
}

/**
 * Enregistre le code PIN de déverrouillage (4 chiffres) de cet agent sur cet
 * appareil — jamais en clair, seulement son hash SHA-256 dans SecureStore
 * (chiffré par l'OS). Réinitialise aussi le verrouillage local, puisqu'un
 * nouveau code mérite un nouveau budget de tentatives.
 */
export async function saveOfflineCredential(
  phoneNumber: string,
  code: string,
): Promise<void> {
  const hash = await hashCode(phoneNumber, code);
  await SecureStore.setItemAsync(credentialKey(phoneNumber), hash);
  await AsyncStorage.removeItem(attemptsKey(phoneNumber));
  await AsyncStorage.removeItem(lockedUntilKey(phoneNumber));
}

/**
 * Vérifie le code PIN saisi contre le hash stocké localement, avec un
 * verrouillage progressif (voir LOGIN_LOCKOUT_TIERS). Ne fait aucun appel
 * réseau : marche en ligne comme hors-ligne.
 */
export async function verifyOfflineCredential(
  phoneNumber: string,
  code: string,
): Promise<{ valid: boolean; message?: string }> {
  const lockedUntilRaw = await AsyncStorage.getItem(lockedUntilKey(phoneNumber));
  const lockedUntil = lockedUntilRaw ? Number(lockedUntilRaw) : null;
  if (lockedUntil && lockedUntil > Date.now()) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return {
      valid: false,
      message: `Compte verrouillé. Réessayez dans ${minutes} minutes.`,
    };
  }

  const storedHash = await SecureStore.getItemAsync(credentialKey(phoneNumber));
  if (!storedHash) {
    return {
      valid: false,
      message:
        "Aucune connexion hors-ligne enregistrée sur cet appareil. Une connexion réseau est nécessaire.",
    };
  }

  const candidateHash = await hashCode(phoneNumber, code);
  if (candidateHash === storedHash) {
    await AsyncStorage.removeItem(attemptsKey(phoneNumber));
    await AsyncStorage.removeItem(lockedUntilKey(phoneNumber));
    return { valid: true };
  }

  const attemptsRaw = await AsyncStorage.getItem(attemptsKey(phoneNumber));
  const attempts = (attemptsRaw ? Number(attemptsRaw) : 0) + 1;
  await AsyncStorage.setItem(attemptsKey(phoneNumber), String(attempts));

  const lockoutMs = computeLockoutMs(attempts);
  if (lockoutMs) {
    await AsyncStorage.setItem(
      lockedUntilKey(phoneNumber),
      String(Date.now() + lockoutMs),
    );
    const minutes = Math.ceil(lockoutMs / 60000);
    return {
      valid: false,
      message:
        minutes >= 60
          ? `Trop de tentatives. Compte verrouillé ${Math.round(minutes / 60)}h.`
          : `Trop de tentatives. Compte verrouillé ${minutes} minutes.`,
    };
  }

  return { valid: false, message: "Code incorrect." };
}

/** Un code PIN de déverrouillage est-il enregistré pour ce numéro ? */
export async function hasOfflineCredential(phoneNumber: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(credentialKey(phoneNumber))) !== null;
}

/** Efface le secret de déverrouillage hors-ligne — à appeler au logout. */
export async function clearOfflineCredential(phoneNumber: string): Promise<void> {
  await SecureStore.deleteItemAsync(credentialKey(phoneNumber));
  await AsyncStorage.removeItem(attemptsKey(phoneNumber));
  await AsyncStorage.removeItem(lockedUntilKey(phoneNumber));
}
