import { Transaction } from "@/types/transaction";

/** Colonnes DB (schema.sql) : type Dépôt/Retrait, status Terminée/En attente */

export function appTypeToDb(type: Transaction["type"]): "Dépôt" | "Retrait" {
  return type === "deposit" ? "Dépôt" : "Retrait";
}

export function dbTypeToApp(type: string): Transaction["type"] {
  return type === "Dépôt" ? "deposit" : "withdrawal";
}

export function appStatusToDb(status: Transaction["status"]): "Terminée" | "En attente" {
  return status === "completed" ? "Terminée" : "En attente";
}

export function dbStatusToApp(status: string): Transaction["status"] {
  return status === "Terminée" ? "completed" : "pending";
}

export function rowToTransaction(row: {
  id: string;
  client_id: string;
  client_name: string;
  amount: number | string;
  type: string;
  status: string;
  notes?: string | null;
  date: string;
}): Transaction {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount),
    type: dbTypeToApp(row.type),
    date: row.date,
    status: dbStatusToApp(row.status),
    notes: row.notes ?? undefined,
  };
}

export function transactionToInsertRow(
  t: Transaction,
  agentId: string
): Record<string, unknown> {
  return {
    id: t.id,
    agent_id: agentId,
    client_id: t.clientId,
    client_name: t.clientName,
    amount: t.amount,
    type: appTypeToDb(t.type),
    status: appStatusToDb(t.status),
    notes: t.notes ?? null,
    date: t.date,
  };
}
