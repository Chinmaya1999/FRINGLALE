import mongoose from 'mongoose';
import { configSchema } from './SavedDesign.js';
const { Schema } = mongoose;

export const STAGES = [
  'order_placed', 'design_cad_ready', 'customer_approval', 'wax_model', 'casting',
  'stone_setting', 'polishing', 'hallmarking', 'quality_check', 'shipped', 'delivered',
];

const orderSchema = new Schema({
  orderNo: { type: String, unique: true, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{
    design: { type: Schema.Types.ObjectId, ref: 'Design' },
    designName: String,
    config: configSchema,
    qty: Number,
    priceBreakdown: Schema.Types.Mixed,
    manufacturingStatusAtOrder: String,
    huid: String,
  }],
  address: Schema.Types.Mixed,
  lockedGoldRate: { rates: Schema.Types.Mixed, date: String, lockedAt: Date, expiresAt: Date },
  priceBreakdown: Schema.Types.Mixed,                      // order-level totals
  coupon: { code: String, discount: Number },
  payment: {
    mode: { type: String, enum: ['full', 'advance'], default: 'full' },
    paid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'failed', 'refunded'], default: 'pending' },
  },
  stage: { type: String, enum: STAGES, default: 'order_placed', index: true },
  stageHistory: [{
    stage: String, at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' }, note: String,
  }],
  approval: {
    status: { type: String, enum: ['not_required', 'pending', 'approved', 'changes_requested'], default: 'not_required' },
    media: [String],                                       // CAD renders / wax photos
    comment: String,
    decidedAt: Date,
  },
  huid: String,
  certificates: [{ name: String, url: String }],
  trackingNumber: String,
  courier: String,
}, { timestamps: true });

export const Order = mongoose.model('Order', orderSchema);
