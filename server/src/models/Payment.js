import mongoose from 'mongoose';
const { Schema } = mongoose;

const paymentSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  amount: Number,                                          // INR
  kind: { type: String, enum: ['full', 'advance', 'balance'], default: 'full' },
  status: { type: String, enum: ['created', 'captured', 'failed', 'refunded'], default: 'created' },
  raw: Schema.Types.Mixed,
}, { timestamps: true });

export const Payment = mongoose.model('Payment', paymentSchema);
