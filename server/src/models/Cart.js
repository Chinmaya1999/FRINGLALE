import mongoose from 'mongoose';
import { configSchema } from './SavedDesign.js';
const { Schema } = mongoose;

const cartSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{
    design: { type: Schema.Types.ObjectId, ref: 'Design', required: true },
    config: configSchema,
    qty: { type: Number, default: 1, min: 1, max: 5 },
  }],
  coupon: String,
  lock: { goldRateId: { type: Schema.Types.ObjectId, ref: 'GoldRate' }, rates: Schema.Types.Mixed, expiresAt: Date },
}, { timestamps: true });

export const Cart = mongoose.model('Cart', cartSchema);
