'use client';

import { useMemo, useState } from 'react';
import { LEAD_STATUSES } from '@/types/lead';
import type { SerializedLead, SerializedAgent, LeadStatus } from '@/types/lead';
import LeadFormModal from './LeadFormModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

const statusStyles: Record<LeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200',
  Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'In Progress': 'bg-purple-50 text-purple-700 border-purple-200',
  Closed: 'bg-green-50 text-green-700 border-green-200',
};

type Props = {
  initialLeads: SerializedLead[];
  role: 'Admin' | 'Agent';
  currentUserId: string;
  agents: SerializedAgent[];
};

export default function LeadsView({ initialLeads, role, currentUserId, agents }: Props) {
  const [leads, setLeads] = useState<SerializedLead[]>(initialLeads);
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<SerializedLead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedLead | null>(null);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.propertyInterest.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, statusFilter, search]);

  function openCreate() {
    setEditingLead(null);
    setFormOpen(true);
  }

  function openEdit(lead: SerializedLead) {
    setEditingLead(lead);
    setFormOpen(true);
  }

  function handleSaved(lead: SerializedLead) {
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l._id === lead._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = lead;
        return next;
      }
      return [lead, ...prev];
    });
    setFormOpen(false);
  }

  async function handleDelete(lead: SerializedLead) {
    const res = await fetch(`/api/leads/${lead._id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Failed to delete lead');
    }
    setLeads((prev) => prev.filter((l) => l._id !== lead._id));
    setDeleteTarget(null);
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads</h1>
          <p className="text-sm text-black mt-0.5">
            {role === 'Admin'
              ? `Showing all ${leads.length} leads in the system`
              : `Showing ${leads.length} leads assigned to you`}
          </p>
        </div>
        {role === 'Admin' && (
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Lead
          </button>
        )}
      </div>

      {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or property…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | LeadStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-black uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Property Interest</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                {role === 'Admin' && <th className="px-4 py-3">Assigned To</th>}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={role === 'Admin' ? 8 : 7}
                    className="px-4 py-12 text-center text-black"
                  >
                    No leads to display.{' '}
                    {role === 'Admin' && (
                      <button
                        onClick={openCreate}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Create your first lead
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-black">{lead.name}</div>
                      {lead.notes && (
                        <div className="text-xs text-black truncate max-w-[200px]">
                          {lead.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-black">{lead.email}</div>
                      <div className="text-xs text-black">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-black">{lead.propertyInterest}</td>
                    <td className="px-4 py-3 text-black">
                      {lead.budget.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[lead.status]}`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
                          />
                        </div>
                        <span className="text-xs text-black w-7">{lead.score}</span>
                      </div>
                    </td>
                    {role === 'Admin' && (
                      <td className="px-4 py-3 text-black">
                        {lead.assignedTo.name || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(lead)}
                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium mr-3"
                      >
                        Edit
                      </button>
                      {role === 'Admin' && (
                        <button
                          onClick={() => setDeleteTarget(lead)}
                          className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <LeadFormModal
          mode={editingLead ? 'edit' : 'create'}
          initialLead={editingLead}
          role={role}
          currentUserId={currentUserId}
          agents={agents}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          lead={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
