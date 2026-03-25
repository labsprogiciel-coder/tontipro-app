-- =============================================
-- TontiPro — Schéma de base de données Supabase
-- Fichier : supabase/schema.sql
-- Ce fichier peut recréer le schéma à partir de zéro
-- =============================================

-- ── 1. TABLE : profiles ──────────────────────────────────────
-- Prolonge auth.users avec les infos de l'agent

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  role        TEXT        NOT NULL DEFAULT 'agent',
  agent_code  TEXT        UNIQUE, -- ex: AGENT001
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent: lecture profil personnel"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Agent: modification profil personnel"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── 2. TABLE : clients ───────────────────────────────────────
-- Clients enregistrés par les agents

CREATE TABLE IF NOT EXISTS clients (
  id           TEXT        PRIMARY KEY, -- généré par l'app (CL...)
  agent_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  balance      NUMERIC     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  address      TEXT,
  id_number    TEXT,
  id_type      TEXT        CHECK (id_type IN ('cni', 'passport', 'permis', 'autre')),
  kyc_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  kyc_date     TIMESTAMPTZ,
  join_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent: lecture ses propres clients"
  ON clients FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agent: insertion ses propres clients"
  ON clients FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agent: modification ses propres clients"
  ON clients FOR UPDATE
  USING (agent_id = auth.uid());

CREATE POLICY "Agent: suppression ses propres clients"
  ON clients FOR DELETE
  USING (agent_id = auth.uid());

-- ── 3. TABLE : transactions ──────────────────────────────────
-- Transactions (dépôts/retraits) effectuées par les agents

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT        PRIMARY KEY, -- généré par l'app (TR...)
  agent_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id   TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name TEXT        NOT NULL, -- dénormalisé pour usage hors ligne
  amount      NUMERIC     NOT NULL CHECK (amount > 0),
  type        TEXT        NOT NULL CHECK (type IN ('Dépôt', 'Retrait')),
  status      TEXT        NOT NULL DEFAULT 'Terminée' CHECK (status IN ('Terminée', 'En attente')),
  notes       TEXT,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent: lecture ses propres transactions"
  ON transactions FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agent: insertion ses propres transactions"
  ON transactions FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agent: modification ses propres transactions"
  ON transactions FOR UPDATE
  USING (agent_id = auth.uid());

CREATE POLICY "Agent: suppression ses propres transactions"
  ON transactions FOR DELETE
  USING (agent_id = auth.uid());

-- ── 4. TRIGGER : updated_at automatique ─────────────────────
-- Met à jour updated_at automatiquement sur clients

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. TRIGGER : création automatique du profil ─────────────
-- Crée un profil quand un agent s'inscrit via Supabase Auth
-- ✅ Sans email — la colonne n'existe pas dans profiles

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Agent'),
    NEW.phone,
    'agent'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();