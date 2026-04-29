export const LEAD_STATUSES = ['New', 'Contacted', 'In Progress', 'Closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PRIORITY_LEVELS = ['High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];

export type SerializedAgent = {
  _id: string;
  name: string;
  email: string;
};

export type SerializedLead = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: number;
  status: LeadStatus;
  priority: Priority;
  notes: string;
  assignedTo: SerializedAgent | null;
  score: number;
  createdAt: string;
  updatedAt: string;
};

export type LeadFormInput = {
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: number;
  status: LeadStatus;
  notes: string;
  assignedTo?: string | null;
};
