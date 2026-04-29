import type { SerializedLead } from '@/types/lead';

type PopulatedAgent = { _id: { toString(): string } | string; name: string; email: string };

type RawLead = {
  _id: { toString(): string } | string;
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: number;
  status: SerializedLead['status'];
  priority?: SerializedLead['priority'];
  notes?: string;
  assignedTo?: PopulatedAgent | { toString(): string } | string | null;
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
  const raw = lead.assignedTo;

  let assignedTo: SerializedLead['assignedTo'] = null;
  if (raw != null) {
    const isPopulated =
      typeof raw === 'object' && 'name' in raw && 'email' in raw;
    assignedTo = isPopulated
      ? {
          _id: idToString((raw as PopulatedAgent)._id),
          name: (raw as PopulatedAgent).name,
          email: (raw as PopulatedAgent).email,
        }
      : { _id: idToString(raw), name: '', email: '' };
  }

  return {
    _id: idToString(lead._id),
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    propertyInterest: lead.propertyInterest,
    budget: lead.budget,
    status: lead.status,
    priority: lead.priority ?? 'Low',
    followUpDate: (lead as any).followUpDate
      ? (lead as any).followUpDate instanceof Date
        ? (lead as any).followUpDate.toISOString()
        : String((lead as any).followUpDate)
      : null,
    notes: lead.notes ?? '',
    assignedTo,
    score: lead.score ?? 25,
    lastActivityAt: (lead as any).lastActivityAt ?? null,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
    updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : lead.updatedAt,
  };
}
