# GEMINI.md

## Project Overview
**Yembi** (also known as **ÉpargneMobile** or **TontiPro**) is a mobile application designed for field agents in French-speaking Africa to manage informal savings (Tontines). It features an **offline-first** architecture to handle intermittent internet connectivity in remote areas.

- **Main Technologies:** Expo SDK 54, React Native 0.81, TypeScript, Zustand (State Management), Supabase (Backend/Database).
- **Core Features:** Agent authentication (ID/PIN), Client management (KYC scan), Transaction recording (Deposits/Withdrawals), Performance reports, and Offline synchronization.
- **Language & Localization:** Interface in **French**, currency in **FCFA**.

## Project Structure
- `app/`: Expo Router file-based navigation.
  - `(auth)/`: Authentication flows (Login, Register, Splash).
  - `(app)/`: Main application (Dashboard, Clients, Transactions, Reports, Settings).
  - `components/`: UI components organized by domain.
- `stores/`: Zustand stores for state management (Auth, Client, Transaction, Config, Navigation).
- `hooks/`: Custom React hooks, notably `useNetworkSync.ts` for offline handling.
- `lib/`: Supabase client and database mapping utilities.
- `types/`: TypeScript interfaces and types.
- `utils/`: Helper functions (ID generation, network status).
- `supabase/`: Database schema and RLS policies.
- `__dev__/`: Mock data and development configuration.

## Development Workflow

### Installation & Commands
```bash
# Install dependencies
bun install

# Start development server
bun start

# Platforms
bun android
bun ios
bun web

# Quality checks
bun lint
bun type-check
```

### Environment Configuration
The project uses environment variables (see `.env.example`).
- `EXPO_PUBLIC_DEV_LOAD_MOCKS`: Set to `true` to use mock data for development without a Supabase connection.

### Offline-First Architecture
1.  **Persistence:** All Zustand stores are persisted to `AsyncStorage` using the `persist` middleware.
2.  **Optimistic Updates:** When a client or transaction is added, it's immediately updated in the local store.
3.  **Sync Logic:**
    - Pending items are marked with a `syncStatus: "pending"` or stored in `pendingTransactions`.
    - `useNetworkSync` hook (mounted in `_layout.tsx`) listens for network changes.
    - Upon reconnection, it triggers `syncPendingClients` and `syncPendingTransactions`.
4.  **Data Mapping:** `lib/transaction-supabase.ts` handles conversion between application-level camelCase and Supabase snake_case/French-labeled columns.

### Coding Conventions
- **Naming:** Use camelCase for variables/functions and PascalCase for components.
- **Types:** Strictly use TypeScript for all new code. Avoid `any`.
- **UI:** Prefer standard components from `app/components/ui`.
- **Translations:** Keep all user-facing text in French.

## Data Model (Supabase)
- **profiles:** Extended user info (agent_code, role).
- **clients:** Customer records. IDs start with `CL`.
- **transactions:** Financial records. IDs start with `TR`.
- **RLS:** Row Level Security is enabled. Agents can only access their own clients and transactions via `agent_id = auth.uid()`.

## Testing
- **Manual Testing:** Use `EXPO_PUBLIC_DEV_LOAD_MOCKS=true` to test UI features with pre-populated data.
- **Credentials:** Default test agent `AGT001` / `1234`.
