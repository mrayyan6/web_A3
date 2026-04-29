import type { SerializedLead } from '@/types/lead';
import ActivityLog from '@/models/ActivityLog';
import type { ActivityAction } from '@/models/ActivityLog';

export async function recordActivity(
  lead: SerializedLead,
  action: ActivityAction,
  actorId?: string,
  meta?: Record<string, unknown>
) {
  try {
    await ActivityLog.create({
      leadId: lead._id,
      action,
      actor: actorId ?? null,
      meta: meta ?? {},
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[ACTIVITY] failed to record', err);
  }
}

export default {};
