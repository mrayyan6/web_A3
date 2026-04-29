import type { LeadStatus } from '@/models/Lead';

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
  notes: string;
  assignedTo: SerializedAgent;
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
  assignedTo?: string;
  score: number;
};
