import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type ActivityAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'reassigned'
  | 'notes_updated'
  | 'followup_set'
  | 'followup_cleared'
  | 'other';

export interface IActivityLog extends Document {
  leadId: Types.ObjectId | string;
  action: ActivityAction;
  actor?: Types.ObjectId | string | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivityLog>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    action: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

const ActivityLog: Model<IActivityLog> =
  (mongoose.models.ActivityLog as Model<IActivityLog>) ?? mongoose.model<IActivityLog>('ActivityLog', ActivitySchema);

export default ActivityLog;
