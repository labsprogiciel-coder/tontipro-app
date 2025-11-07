export interface MockAgent {
  id: string;
  name: string;
  email?: string;
  pin: string;
  role: "agent";
}

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: "AGENT001",
    name: "Jean Dupont",
    email: "jean.dupont@epargnmobile.com",
    pin: "1234",
    role: "agent",
  },
  {
    id: "AGENT002",
    name: "Marie Kouassi",
    email: "marie.kouassi@epargnmobile.com",
    pin: "5678",
    role: "agent",
  },
  {
    id: "AGENT003",
    name: "Amadou Diallo",
    email: "amadou.diallo@epargnmobile.com",
    pin: "9999",
    role: "agent",
  },
  {
    id: "demo",
    name: "Demo Agent",
    email: "demo@epargnmobile.com",
    pin: "0000",
    role: "agent",
  },
];

export function validateCredentials(
  agentId: string,
  pin: string
): MockAgent | null {
  const agent = MOCK_AGENTS.find(
    (a) => a.id.toLowerCase() === agentId.toLowerCase() && a.pin === pin
  );
  return agent || null;
}
