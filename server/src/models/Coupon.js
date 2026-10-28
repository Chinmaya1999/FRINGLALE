import mongoose from 'mongoose';
const { Schema } = mongoose;

const couponSchema = new Schema({
  code: { type: String, unique: true, uppercase: true, required: true },
  type: { type: String, enum: ['percent', 'flat'], required: true },
  value: { type: Number, required: true },
  maxDiscount: Number,
  minOrder: { type: Number, default: 0 },
  validFrom: Date, validTo: Date,
  usageLimit: Number, used: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Coupon = mongoose.model('Coupon', couponSchema);
