import mongoose from 'mongoose';
const { Schema } = mongoose;

// One document per sellable metal variant, e.g. yellow-22K, white-18K, platinum-950, silver-925.
const metalSchema = new Schema({
  key: { type: String, unique: true, required: true },     // "yellow-22K"
  family: { type: String, enum: ['yellow', 'white', 'rose', 'platinum', 'silver'], required: true },
  karat: String,                                           // "14K" | "18K" | "22K" | "950" | "925"
  label: String,
  purity: Number,                                          // fineness e.g. 0.916
  rateKey: { type: String, required: true },               // which goldRates field prices it: "22K" | "18K" | "14K" | "platinum" | "silver"
  densityFactor: { type: Number, required: true },         // vs 18K reference
  hex: String,                                             // base colour for the shader
  roughness: { type: Number, default: 0.12 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Metal = mongoose.model('Metal', metalSchema);
