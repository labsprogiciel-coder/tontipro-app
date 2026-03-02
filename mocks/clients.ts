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

export const mockClients: Client[] = [
  {
    id: "CL001",
    name: "Amadou Diallo",
    phone: "+221 77 123 4567",
    balance: 45000,
    joinDate: "2023-01-15",
    lastDeposit: "2023-05-10",
    status: "active",
    idNumber: "SN-CNI-2845739",
    idType: "cni",
    kycVerified: true,
    kycDate: "2023-01-15",
  },
  {
    id: "CL002",
    name: "Fatou Sow",
    phone: "+221 76 234 5678",
    balance: 28500,
    joinDate: "2023-02-03",
    lastDeposit: "2023-05-08",
    status: "active",
    idNumber: "SN-PASS-A4829174",
    idType: "passport",
    kycVerified: true,
    kycDate: "2023-02-03",
  },
  {
    id: "CL003",
    name: "Moussa Ndiaye",
    phone: "+221 78 345 6789",
    balance: 12000,
    joinDate: "2023-02-20",
    lastDeposit: "2023-04-25",
    status: "active",
  },
  {
    id: "CL004",
    name: "Aissatou Diop",
    phone: "+221 77 456 7890",
    balance: 35000,
    joinDate: "2023-03-05",
    lastDeposit: "2023-05-12",
    status: "active",
  },
  {
    id: "CL005",
    name: "Ibrahima Gueye",
    phone: "+221 76 567 8901",
    balance: 8000,
    joinDate: "2023-03-18",
    lastDeposit: "2023-04-15",
    status: "inactive",
  },
  {
    id: "CL006",
    name: "Mariama Bah",
    phone: "+221 78 678 9012",
    balance: 22000,
    joinDate: "2023-04-02",
    lastDeposit: "2023-05-05",
    status: "active",
  },
  {
    id: "CL007",
    name: "Ousmane Fall",
    phone: "+221 77 789 0123",
    balance: 15500,
    joinDate: "2023-04-15",
    lastDeposit: "2023-05-01",
    status: "active",
  },
];