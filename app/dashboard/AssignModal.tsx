'use client';

import { FormEvent, useState } from 'react';
import type { SerializedLead, SerializedAgent } from '@/types/lead';

type Props = {
  lead: SerializedLead;
  agents: SerializedAgent[];
  onClose: () => void;
  onAssigned: (updated: SerializedLead) => void;
};

export default function AssignModal({ lead, agents, onClose, onAssigned }: Props) {
  const [selectedAgent, setSelectedAgent] = useState(lead.assignedTo?._id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isReassign = lead.assignedTo !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const res = await fetch(`/api/leads/${lead._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: selectedAgent || null }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to update assignment');
      return;
    }

    onAssigned(data.lead);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">
            {isReassign ? 'Reassign Lead' : 'Assign Lead'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Lead</p>
            <p className="text-sm font-medium text-black">{lead.name}</p>
          </div>

          {isReassign && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Currently assigned to</p>
              <p className="text-sm font-medium text-black">
                {lead.assignedTo!.name}{' '}
                <span className="text-gray-400">({lead.assignedTo!.email})</span>
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="agent-select"
              className="block text-sm font-medium text-black mb-1"
            >
              {isReassign ? 'Reassign to' : 'Assign to'}
            </label>
            <select
              id="agent-select"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Unassigned —</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
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
              {submitting ? 'Saving…' : isReassign ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
