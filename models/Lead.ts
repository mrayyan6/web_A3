import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { LeadStatus, LEAD_STATUSES } from '@/types/lead';

export interface ILead extends Document {
  name: string;
  email: string;
  phone: string;
  propertyInterest: string;
  budget: number;
  status: LeadStatus;
  notes: string;
  assignedTo: Types.ObjectId;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: { type: String, required: [true, 'Phone is required'], trim: true },
    propertyInterest: {
      type: String,
      required: [true, 'Property interest is required'],
      trim: true,
    },
    budget: { type: Number, required: [true, 'Budget is required'], min: 0 },
    status: {
      type: String,
      enum: { values: LEAD_STATUSES, message: 'Invalid status' },
      default: 'New',
      index: true,
    },
    notes: { type: String, default: '', trim: true },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'assignedTo is required'],
      index: true,
    },
    score: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

const Lead: Model<ILead> =
  (mongoose.models.Lead as Model<ILead>) ?? mongoose.model<ILead>('Lead', LeadSchema);

export default Lead;
