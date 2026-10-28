import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * Honesty model for the 3D studio. Every design declares exactly what is backed by
 * real GLB assets vs. simulated in the shader, and whether it can be manufactured.
 *  - assetVariants: real GLB files, one per (stoneShape) combination
 *  - simulated: features rendered procedurally only
 *  - manufacturing: approval state shown to the customer
 */
const variantSchema = new Schema({
  key: { type: String, required: true },          // e.g. "round", "oval"
  stoneShape: String,
  glbUrl: { type: String, required: true },
  sizeBytes: Number,
  triangles: Number,
  lodUrls: { low: String, mid: String },          // optional lower-poly LODs
}, { _id: false });

const designSchema = new Schema({
  slug: { type: String, unique: true, required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['ring', 'pendant', 'earring', 'necklace', 'bangle'], required: true, index: true },
  description: String,
  occasions: [{ type: String, enum: ['wedding', 'engagement', 'gifting', 'daily'] }],
  collection: { type: String, enum: ['bridal', 'red-carpet', 'heritage', 'everyday', 'signature'], index: true },
  images: [String],
  baseWeight: { type: Number, required: true },   // grams at 18K reference, default size
  makingType: { type: String, enum: ['percent', 'perGram'], default: 'percent' },
  makingValue: { type: Number, required: true },  // % of metal price, or INR per gram
  allowedMetals: [String],                        // metal keys
  allowedStoneTypes: [String],
  allowedShapes: [String],
  allowedQualities: [String],
  allowedSizes: [String],
  sizeFactors: { type: Map, of: Number },         // overrides settings.sizeFactors
  caratRange: { min: { type: Number, default: 0.1 }, max: { type: Number, default: 3 } },
  stoneCount: { type: Number, default: 1 },
  engravingMaxChars: { type: Number, default: 15 },

  model3d: {
    primaryGlbUrl: String,
    procedural: String,                          // parametric preview style when no GLB exists (always labelled simulated)
    fit: { type: Number, default: 1 },           // camera framing multiplier (necklaces/earrings need more room)
    assetVariants: [variantSchema],
    assetBackedMetals: [String],                 // metals with dedicated baked materials/assets
    explodedView: { type: Boolean, default: false },
    components: [{ id: String, label: String, meshName: String }],
    dimensionsMm: { width: Number, height: Number, depth: Number, bandWidth: Number },
    annotations: [{ label: String, meshName: String, valueMm: Number }],
  },
  simulated: [String],                           // e.g. ["metal-colour","stone-shape","engraving"]
  manufacturing: {
    status: { type: String, enum: ['concept', 'cad_ready', 'approved_for_manufacturing'], default: 'concept' },
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  isActive: { type: Boolean, default: true, index: true },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

export const Design = mongoose.model('Design', designSchema);
