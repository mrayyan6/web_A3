import type { SerializedLead } from '@/types/lead';

type RawLead = {
  _id: { toString(): string } | string;
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: number;
  status: SerializedLead['status'];
  notes?: string;
  assignedTo:
    | { _id: { toString(): string } | string; name: string; email: string }
    | { toString(): string }
    | string;
  score?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function idToString(id: unknown): string {
  if (typeof id === 'string') return id;
  if (id && typeof (id as { toString: () => string }).toString === 'function') {
    return (id as { toString: () => string }).toString();
  }
  return '';
}

export function serializeLead(lead: RawLead): SerializedLead {
  const assignedTo = lead.assignedTo as RawLead['assignedTo'];
  const isPopulated =
    typeof assignedTo === 'object' &&
    assignedTo !== null &&
    'name' in assignedTo &&
    'email' in assignedTo;

  return {
    _id: idToString(lead._id),
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    propertyInterest: lead.propertyInterest,
    budget: lead.budget,
    status: lead.status,
    notes: lead.notes ?? '',
    assignedTo: isPopulated
      ? {
          _id: idToString((assignedTo as { _id: unknown })._id),
          name: (assignedTo as { name: string }).name,
          email: (assignedTo as { email: string }).email,
        }
      : { _id: idToString(assignedTo), name: '', email: '' },
    score: lead.score ?? 0,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
    updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : lead.updatedAt,
  };
}
