'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import type { SerializedLead, SerializedAgent, LeadStatus } from '@/types/lead';
import { LEAD_STATUSES } from '@/types/lead';
import { computePriority } from '@/lib/scoring';
import LeadTimeline from './LeadTimeline';

type Mode = 'create' | 'edit';

type Props = {
  mode: Mode;
  initialLead: SerializedLead | null;
  role: 'Admin' | 'Agent';
  currentUserId: string;
  agents: SerializedAgent[];
  onClose: () => void;
  onSaved: (lead: SerializedLead) => void;
};

const priorityColors = {
  High: 'bg-red-100 text-red-700 border-red-300',
  Medium: 'bg-amber-100 text-amber-700 border-amber-300',
  Low: 'bg-green-100 text-green-700 border-green-300',
};

export default function LeadFormModal({
  mode,
  initialLead,
  role,
  currentUserId,
  agents,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialLead?.name ?? '');
  const [email, setEmail] = useState(initialLead?.email ?? '');
  const [phone, setPhone] = useState(initialLead?.phone ?? '');
  const [propertyInterest, setPropertyInterest] = useState(
    initialLead?.propertyInterest ?? ''
  );
  const [budget, setBudget] = useState<string>(
    initialLead?.budget != null ? String(initialLead.budget) : ''
  );
  const [derivedPriority, setDerivedPriority] = useState<string>(
    initialLead?.priority ? `${initialLead.priority}` : 'Low'
  );
  const [followUpDate, setFollowUpDate] = useState<string | null>(
    initialLead?.followUpDate ?? null
  );
  const [status, setStatus] = useState<LeadStatus>(initialLead?.status ?? 'New');
  const [notes, setNotes] = useState(initialLead?.notes ?? '');
  const [assignedTo, setAssignedTo] = useState(
    initialLead?.assignedTo?._id ?? (role === 'Admin' ? '' : currentUserId)
  );

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live priority preview derived from the budget field
  const previewPriority = budget ? computePriority(Number(budget)) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name,
      email,
      phone,
      propertyInterest,
      budget: Number(budget),
      status,
      notes,
      followUpDate: followUpDate ?? null,
    };

    // Admins can assign or leave unassigned; Agents always submit their own id server-side
    if (role === 'Admin') {
      payload.assignedTo = assignedTo || null;
    }

    const url = mode === 'create' ? '/api/leads' : `/api/leads/${initialLead!._id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    onSaved(data.lead);
  }

  // Recalculate priority live when budget changes
  useEffect(() => {
    const num = Number(budget || 0);
    try {
      const p = computePriority(num);
      setDerivedPriority(p);
    } catch (e) {
      setDerivedPriority('Low');
    }
  }, [budget]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            {mode === 'create' ? 'New Lead' : 'Edit Lead'}
          </h2>
          <button
            onClick={onClose}
            className="text-black hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Phone" required>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Property Interest" required>
              <input
                type="text"
                value={propertyInterest}
                onChange={(e) => setPropertyInterest(e.target.value)}
                required
                placeholder="e.g. 3BR Apartment, Downtown"
                className={inputClass}
              />
            </Field>

            <Field label="Budget (PKR)" required>
              <div className="space-y-1">
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  required
                  className={inputClass}
                />
                <div className="mt-1 text-sm text-black">Priority: {derivedPriority}</div>
              </div>
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className={inputClass}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            {role === 'Admin' && (
              <Field label="Assigned To">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Unassigned —</option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Anything worth remembering about this lead…"
            />
          </Field>

          <Field label="Follow-up Date">
            <input
              type="date"
              value={followUpDate ?? ''}
              onChange={(e) => setFollowUpDate(e.target.value || null)}
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create Lead' : 'Save Changes'}
            </button>
          </div>
        </form>

        {mode === 'edit' && initialLead && (
          <div className="px-6 py-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-black mb-2">Lead Timeline</h3>
            <LeadTimeline leadId={initialLead._id} />
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-black mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
