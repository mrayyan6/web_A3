'use client';

import { useEffect, useMemo, useState } from 'react';
import { LEAD_STATUSES, PRIORITY_LEVELS } from '@/types/lead';
import type { SerializedLead, SerializedAgent, LeadStatus, Priority } from '@/types/lead';
import LeadFormModal from './LeadFormModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import AssignModal from './AssignModal';

// ─── Badge style maps ────────────────────────────────────────────────────────

const statusStyles: Record<LeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200',
  Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'In Progress': 'bg-purple-50 text-purple-700 border-purple-200',
  Closed: 'bg-green-50 text-green-700 border-green-200',
};

const priorityStyles: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700 border-red-300',
  Medium: 'bg-amber-100 text-amber-700 border-amber-300',
  Low: 'bg-green-100 text-green-700 border-green-300',
};

// High-priority rows get a subtle tinted background
const rowBg: Record<Priority, string> = {
  High: 'bg-red-50 hover:bg-red-100',
  Medium: 'hover:bg-gray-50',
  Low: 'hover:bg-gray-50',
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  initialLeads: SerializedLead[];
  role: 'Admin' | 'Agent';
  currentUserId: string;
  agents: SerializedAgent[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadsView({ initialLeads, role, currentUserId, agents }: Props) {
  const [leads, setLeads] = useState<SerializedLead[]>(initialLeads);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<SerializedLead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedLead | null>(null);
  const [assignTarget, setAssignTarget] = useState<SerializedLead | null>(null);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && l.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.propertyInterest.toLowerCase().includes(q) ||
          (l.assignedTo?.name ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, statusFilter, priorityFilter, search]);

  // ── Poll for new data every 10 s so the UI stays in sync without a refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/leads');
        if (res.ok) {
          const data = await res.json() as { leads: SerializedLead[] };
          setLeads(data.leads);
        }
      } catch {
        // silently ignore — next tick will retry
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // ── Counts for summary chips ─────────────────────────────────────────────
  const unassignedCount = role === 'Admin' ? leads.filter((l) => !l.assignedTo).length : 0;
  const highPriorityCount = leads.filter((l) => l.priority === 'High').length;

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  function handleAssigned(lead: SerializedLead) {
    setLeads((prev) =>
      prev.map((l) => (l._id === lead._id ? lead : l))
    );
    setAssignTarget(null);
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

  // ── Admin column count (for empty-state colspan) ──────────────────────────
  const colCount = role === 'Admin' ? 9 : 7;

  return (
    <div className="space-y-4">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">
              {role === 'Admin'
                ? `${leads.length} total`
                : `${leads.length} assigned to you`}
            </span>
            {highPriorityCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">
                {highPriorityCount} High Priority
              </span>
            )}
            {role === 'Admin' && unassignedCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-orange-100 text-orange-700 border-orange-300">
                {unassignedCount} Unassigned
              </span>
            )}
          </div>
        </div>

        {role === 'Admin' && (
          <button
            onClick={openCreate}
            className="shrink-0 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Lead
          </button>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, property, agent…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | LeadStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
        >
          <option value="All">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'All' | Priority)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
        >
          <option value="All">All priorities</option>
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-black uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Priority</th>
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
                    colSpan={colCount}
                    className="px-4 py-12 text-center text-black"
                  >
                    No leads match the current filters.{' '}
                    {role === 'Admin' && (
                      <button
                        onClick={openCreate}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Create the first lead
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead._id} className={rowBg[lead.priority]}>
                    {/* Name + notes */}
                    <td className="px-4 py-3 max-w-45">
                      <div className="font-medium text-black truncate">{lead.name}</div>
                      {lead.notes && (
                        <div className="text-xs text-gray-500 truncate">{lead.notes}</div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="text-black">{lead.email}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{lead.phone}</span>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
                          title="Open WhatsApp chat"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </td>

                    {/* Property */}
                    <td className="px-4 py-3 text-black max-w-40">
                      <div className="truncate">{lead.propertyInterest}</div>
                    </td>

                    {/* Budget */}
                    <td className="px-4 py-3 text-black whitespace-nowrap">
                      {lead.budget.toLocaleString('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        maximumFractionDigits: 0,
                      })}
                    </td>

                    {/* Priority badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityStyles[lead.priority]}`}
                      >
                        {lead.priority === 'High' && (
                          <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                        {lead.priority} Priority
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[lead.status]}`}
                      >
                        {lead.status}
                      </span>
                    </td>

                    {/* Score bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              lead.priority === 'High'
                                ? 'bg-red-500'
                                : lead.priority === 'Medium'
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
                          />
                        </div>
                        <span className="text-xs text-black w-7">{lead.score}</span>
                      </div>
                    </td>

                    {/* Assigned To (Admin only) */}
                    {role === 'Admin' && (
                      <td className="px-4 py-3">
                        {lead.assignedTo ? (
                          <div>
                            <div className="text-black text-sm">{lead.assignedTo.name}</div>
                            <div className="text-xs text-gray-500">{lead.assignedTo.email}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-300">
                            Unassigned
                          </span>
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(lead)}
                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium"
                      >
                        Edit
                      </button>

                      {role === 'Admin' && (
                        <>
                          <span className="mx-1.5 text-gray-300">|</span>
                          <button
                            onClick={() => setAssignTarget(lead)}
                            className="text-indigo-600 hover:text-indigo-700 hover:underline text-sm font-medium"
                          >
                            {lead.assignedTo ? 'Reassign' : 'Assign'}
                          </button>
                          <span className="mx-1.5 text-gray-300">|</span>
                          <button
                            onClick={() => setDeleteTarget(lead)}
                            className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
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

      {assignTarget && (
        <AssignModal
          lead={assignTarget}
          agents={agents}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
}
