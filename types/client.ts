export type CollectionFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface Client {
  id: string;
  name: string;
  phone: string;
  balance: number;
  joinDate: string;
  lastDeposit?: string;
  status: "active" | "inactive";
  address?: string;
  email?: string;
  groupName?: string;
  commitmentAmount?: number;
  collectionFrequency?: CollectionFrequency;
  collectionDays?: number[];
  savingsGoal?: number;
  accountNumber?: string;
  idNumber?: string;
  idType?: "cni" | "passport" | "permis" | "autre";
  kycVerified?: boolean;
  kycDate?: string;
  syncStatus?: "synced" | "pending";
  /** Created on the device and not yet confirmed by Convex (id is local). */
  localOnly?: boolean;
}
