import mongoose from 'mongoose';
const { Schema } = mongoose;

const stonePriceSchema = new Schema({
  stoneType: { type: String, required: true },
  shape: { type: String, required: true },
  quality: { type: String, required: true },               // e.g. "VS-GH", "AAA"
  pricePerCarat: { type: Number, required: true },
}, { timestamps: true });
stonePriceSchema.index({ stoneType: 1, shape: 1, quality: 1 }, { unique: true });

export const StonePrice = mongoose.model('StonePrice', stonePriceSchema);
