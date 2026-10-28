import mongoose from 'mongoose';
const { Schema } = mongoose;

const stoneSchema = new Schema({
  key: { type: String, unique: true, required: true },     // "natural-diamond"
  label: String,
  kind: { type: String, enum: ['diamond', 'gem'], default: 'gem' },
  ior: Number,                                             // refractive index for shader
  hex: String,
  certified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Stone = mongoose.model('Stone', stoneSchema);
