import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  design: { type: Schema.Types.ObjectId, ref: 'Design', index: true },
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: String, body: String,
  approved: { type: Boolean, default: false },
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
