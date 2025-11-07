export interface Transaction {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: "deposit" | "withdrawal";
  date: string;
  status: "completed" | "pending";
  notes?: string;
}

export const mockTransactions: Transaction[] = [
  {
    id: "TR001",
    clientId: "CL001",
    clientName: "Amadou Diallo",
    amount: 5000,
    type: "deposit",
    date: "2023-05-10T10:30:00",
    status: "completed",
  },
  {
    id: "TR002",
    clientId: "CL002",
    clientName: "Fatou Sow",
    amount: 3000,
    type: "deposit",
    date: "2023-05-08T14:15:00",
    status: "completed",
  },
  {
    id: "TR003",
    clientId: "CL004",
    clientName: "Aissatou Diop",
    amount: 7000,
    type: "deposit",
    date: "2023-05-12T09:45:00",
    status: "completed",
  },
  {
    id: "TR004",
    clientId: "CL006",
    clientName: "Mariama Bah",
    amount: 2000,
    type: "deposit",
    date: "2023-05-05T16:20:00",
    status: "completed",
  },
  {
    id: "TR005",
    clientId: "CL007",
    clientName: "Ousmane Fall",
    amount: 1500,
    type: "deposit",
    date: "2023-05-01T11:10:00",
    status: "completed",
  },
  {
    id: "TR006",
    clientId: "CL001",
    clientName: "Amadou Diallo",
    amount: 10000,
    type: "withdrawal",
    date: "2023-04-28T13:40:00",
    status: "completed",
    notes: "Emergency withdrawal for medical expenses",
  },
  {
    id: "TR007",
    clientId: "CL003",
    clientName: "Moussa Ndiaye",
    amount: 4000,
    type: "deposit",
    date: "2023-04-25T15:30:00",
    status: "completed",
  },
  {
    id: "TR008",
    clientId: "CL005",
    clientName: "Ibrahima Gueye",
    amount: 2000,
    type: "deposit",
    date: "2023-04-15T10:00:00",
    status: "completed",
  },
  {
    id: "TR009",
    clientId: "CL004",
    clientName: "Aissatou Diop",
    amount: 3000,
    type: "deposit",
    date: "2023-05-14T09:15:00",
    status: "pending",
    notes: "Offline transaction",
  },
  {
    id: "TR010",
    clientId: "CL002",
    clientName: "Fatou Sow",
    amount: 5000,
    type: "deposit",
    date: "2023-05-15T14:30:00",
    status: "pending",
    notes: "Offline transaction",
  },
];