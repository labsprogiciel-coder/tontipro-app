# 📱 Yembi

<p align="center">
  <img src="assets/screenshots/1.png" width="22%">
  <img src="assets/screenshots/2.png" width="22%">
  <img src="assets/screenshots/3.png" width="22%">
  <img src="assets/screenshots/4.png" width="22%">
</p>

**ÉpargneMobile** est une application mobile de gestion d'épargne destinée aux agents de terrain en Afrique francophone. Elle permet de gérer les comptes clients, d'enregistrer les transactions (dépôts/retraits) et de suivre les performances, même sans connexion internet.

> **Note :** L'application est optimisée pour un usage **offline-first** afin de pallier les problèmes de connectivité dans les zones reculées.

---

## ✨ Fonctionnalités

- **Authentification :** Connexion sécurisée par ID Agent et PIN, inscription.
- **Tableau de bord :** Vue d'ensemble avec statistiques clés (total collecté, clients actifs, synchro en attente, objectifs).
- **Gestion des clients :** Recherche, ajout de nouveaux membres et scan KYC de pièces d'identité (code-barres).
- **Transactions :** Enregistrement rapide des flux financiers et suivi du statut de synchronisation.
- **Rapports :** Analyse des performances par période et export des données de collecte.
- **Paramètres :** Personnalisation (mode sombre), gestion du profil et mode hors ligne manuel.

---

## 🛠 Stack Technique

| Catégorie            | Technologie                                         |
| -------------------- | --------------------------------------------------- |
| **Framework**        | Expo SDK 54 + React Native 0.81                     |
| **Routing**          | Expo Router (file-based)                            |
| **Langage**          | TypeScript                                          |
| **State Management** | Zustand (persisté via AsyncStorage)                 |
| **Icônes**           | `lucide-react-native`                               |
| **Caméra**           | `expo-camera` (scan KYC)                            |
| **UI Enhancements**  | `expo-blur`, `expo-linear-gradient`, `expo-haptics` |

---

## 📂 Structure du Projet

```text
app/
├── (auth)/                # Flux d'authentification (login, register, splash)
├── (app)/                 # Application principale (système d'onglets)
│   ├── dashboard.tsx      # Accueil et statistiques
│   ├── clients.tsx        # Répertoire client
│   ├── transactions.tsx   # Journal des flux
│   ├── reports.tsx        # Analytics
│   ├── settings.tsx       # Configuration
│   ├── clients/           # Sous-vues clients (details, add, scan)
│   └── transactions/      # Sous-vues transactions (details, new, withdraw)
├── _layout.tsx            # Layout racine (Providers)
└── index.tsx              # Point d'entrée
constants/                 # Thème (colors.ts)
hooks/                     # Hooks personnalisés
mocks/                     # Données de test (agents, clients, transactions)
stores/                    # Logique Zustand (auth, client, transaction)
types/                     # Interfaces TypeScript
utils/                     # Helpers (ID generator, network status)

```

---

## 🔑 Identifiants de Test

| ID Agent | Code PIN |
| -------- | -------- |
| `AGT001` | `1234`   |
| `AGT002` | `5678`   |

---

## ⚙️ Installation & Lancement

Avant de démarrer, copiez `.env.example` en `.env` (ou assurez-vous que le fichier `.env` existe), puis activez/désactivez les données fictives :

- `EXPO_PUBLIC_DEV_LOAD_MOCKS=false` (production / données vides)
- `EXPO_PUBLIC_DEV_LOAD_MOCKS=true` (dev local avec mocks)

```bash
# 1. Installer les dépendances
bun install

# 2. Lancer le serveur de développement
bun start

# 3. Plateformes spécifiques
bun web      # Lancer sur navigateur
bun ios      # Lancer sur simulateur iOS
bun android  # Lancer sur émulateur Android

```

---

## 🧪 Tests automatiques

Le workflow GitHub Actions `.github/workflows/e2e.yml` (« PR checks ») tourne sur chaque pull request vers `main`, chaque push sur `main`, ou à la main :

- **typecheck** : `bun run type-check` et `bun run lint`.
- **e2e-android** : construit un APK de release depuis les sources (`expo prebuild` + Gradle, x86_64 uniquement, mises à jour à distance désactivées pour tester exactement le code de la PR), puis lance les parcours Maestro de `.maestro/` sur un émulateur Android. Aucune minute EAS n’est utilisée. Le rapport JUnit et les captures sont dans l’artefact `maestro-results`.

L’APK de test pointe vers le déploiement Convex **dev** (l’URL de `.env.example`) et n’envoie rien à Sentry. Le parcours `login` reste sur les écrans de connexion (vérifications du formulaire, première connexion, mot de passe oublié) : il n’a besoin d’aucun compte et ne modifie aucune donnée. Pour tester les écrans après connexion, il faudra un compte agent de test sur le déploiement dev, stocké dans les secrets GitHub.

Les parcours Maestro s’appuient sur les textes visibles à l’écran : les garder à jour quand un libellé change. En local, sur un émulateur où l’app est installée :

```bash
maestro test .maestro
```

## 🏗 Architecture & Spécificités

- **Offline-first :** Toutes les données sont persistées localement. Un indicateur visuel permet de voir les transactions en attente de synchronisation avec le serveur.
- **Localisation :** Interface intégralement en **français** et gestion de la devise **FCFA**.
- **Compatibilité Web :** En l'absence de caméra physique sur PC, un fallback de saisie manuelle est prévu pour les données de pièces d'identité.
