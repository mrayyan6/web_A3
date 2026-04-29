'use client';

import { useEffect, useState } from 'react';
import type { SerializedLead } from '@/types/lead';

type Activity = {
  _id: string;
  leadId: string;
  action: string;
  actor?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export default function LeadTimeline({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}/activities`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setItems(data.activities || []);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [leadId]);

  if (loading && items.length === 0) return <div className="text-sm text-gray-500">Loading timeline…</div>;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-sm text-gray-500">No activity recorded for this lead yet.</div>
      ) : (
        <ol className="space-y-3">
          {items.map((it) => (
            <li key={it._id} className="flex gap-3">
              <div className="w-36 text-xs text-gray-500">{new Date(it.createdAt).toLocaleString()}</div>
              <div className="flex-1">
                <div className="text-sm text-black font-medium">{formatAction(it)}</div>
                {it.meta && Object.keys(it.meta).length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">{JSON.stringify(it.meta)}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function formatAction(it: Activity) {
  const a = it.action;
  switch (a) {
    case 'created':
      return 'Lead created';
    case 'status_changed':
      return `Status changed -> ${(it.meta && (it.meta as any).newStatus) || ''}`;
    case 'assigned':
      return `Assigned${(it.meta && (it.meta as any).assignedTo) ? ` to ${(it.meta as any).assignedTo}` : ''}`;
    case 'reassigned':
      return `Reassigned`;
    case 'notes_updated':
      return 'Notes updated';
    case 'followup_set':
      return `Follow-up set: ${(it.meta && (it.meta as any).followUpDate) || ''}`;
    case 'followup_cleared':
      return 'Follow-up cleared';
    default:
      return a;
  }
}
