// __dev__/mocks/agents.ts
export type AgentRole = "admin" | "agent" | "blocked";

export interface MockAgent {
  id: string;
  initials: string;
  name: string;
  role: AgentRole;
  phone: string;
  zone: string;
  ref: string;
  joinedAt: string;
  online: boolean;
  stats: {
    clients: number;
    transactions: number;
    collected: string;
  };
  permissions: {
    addClient: boolean;
    editClient: boolean;
    deposit: boolean;
    withdrawal: boolean;
    exportReports: boolean;
    manageAgents: boolean;
    importData: boolean;
  };
}

export const mockAgents: MockAgent[] = [
  {
    id: "AGT001",
    initials: "KD",
    name: "Konaté Djibril",
    role: "admin",
    phone: "+226 70 11 22 33",
    zone: "Ouaga 2000",
    ref: "AGT-2025-001",
    joinedAt: "2025-01-02",
    online: true,
    stats: { clients: 38, transactions: 310, collected: "820k" },
    permissions: {
      addClient: true,
      editClient: true,
      deposit: true,
      withdrawal: true,
      exportReports: true,
      manageAgents: true,
      importData: true,
    },
  },
  {
    id: "AGT002",
    initials: "AS",
    name: "Agathe Sawadogo",
    role: "agent",
    phone: "+226 76 33 44 55",
    zone: "Pissy, Ouagadougou",
    ref: "AGT-2025-002",
    joinedAt: "2025-01-12",
    online: true,
    stats: { clients: 24, transactions: 186, collected: "312k" },
    permissions: {
      addClient: true,
      editClient: true,
      deposit: true,
      withdrawal: true,
      exportReports: false,
      manageAgents: false,
      importData: false,
    },
  },
  {
    id: "AGT003",
    initials: "RO",
    name: "Rasmané Ouédraogo",
    role: "agent",
    phone: "+226 62 55 66 77",
    zone: "Gounghin",
    ref: "AGT-2025-003",
    joinedAt: "2025-01-15",
    online: true,
    stats: { clients: 19, transactions: 142, collected: "205k" },
    permissions: {
      addClient: true,
      editClient: true,
      deposit: true,
      withdrawal: false,
      exportReports: false,
      manageAgents: false,
      importData: false,
    },
  },
  {
    id: "AGT004",
    initials: "FT",
    name: "Fatou Traoré",
    role: "agent",
    phone: "+226 70 77 88 99",
    zone: "Tampouy",
    ref: "AGT-2025-004",
    joinedAt: "2025-01-20",
    online: false,
    stats: { clients: 17, transactions: 120, collected: "178k" },
    permissions: {
      addClient: true,
      editClient: true,
      deposit: true,
      withdrawal: false,
      exportReports: false,
      manageAgents: false,
      importData: false,
    },
  },
  {
    id: "AGT005",
    initials: "IK",
    name: "Ibrahim Kaboré",
    role: "agent",
    phone: "+226 71 22 33 44",
    zone: "Dapoya",
    ref: "AGT-2025-005",
    joinedAt: "2025-01-25",
    online: false,
    stats: { clients: 12, transactions: 88, collected: "110k" },
    permissions: {
      addClient: true,
      editClient: true,
      deposit: true,
      withdrawal: false,
      exportReports: false,
      manageAgents: false,
      importData: false,
    },
  },
  {
    id: "AGT006",
    initials: "MZ",
    name: "Moussa Zongo",
    role: "blocked",
    phone: "+226 76 44 55 66",
    zone: "Secteur 30",
    ref: "AGT-2025-006",
    joinedAt: "2025-02-01",
    online: false,
    stats: { clients: 8, transactions: 54, collected: "67k" },
    permissions: {
      addClient: false,
      editClient: false,
      deposit: false,
      withdrawal: false,
      exportReports: false,
      manageAgents: false,
      importData: false,
    },
  },
];

export const MOCK_AGENT_STATS = {
  total: mockAgents.length,
  online: mockAgents.filter((a) => a.online).length,
  blocked: mockAgents.filter((a) => a.role === "blocked").length,
};
