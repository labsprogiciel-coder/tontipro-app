export interface Client {
  id: string;
  name: string;
  phone: string;
  balance: number;
  joinDate: string;
  lastDeposit?: string;
  status: "active" | "inactive";
  address?: string;
  idNumber?: string;
  idType?: "cni" | "passport" | "permis" | "autre";
  kycVerified?: boolean;
  kycDate?: string;
}