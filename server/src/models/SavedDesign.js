import mongoose from 'mongoose';
const { Schema } = mongoose;

export const configSchema = new Schema({
  metal: String, stoneType: String, shape: String, quality: String,
  carat: Number, size: String, engraving: { type: String, default: '' },
  giftBox: { type: Boolean, default: false }, insurance: { type: Boolean, default: true },
}, { _id: false });

const savedDesignSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  design: { type: Schema.Types.ObjectId, ref: 'Design', required: true },
  name: String,
  config: configSchema,
  // Snapshot of the support level at save time so the UI can show what the customer saw.
  supportSnapshot: { assetBacked: Boolean, simulatedFeatures: [String], manufacturingStatus: String },
  lastQuote: { total: Number, goldRateDate: String, quotedAt: Date },
  thumbnail: String,
}, { timestamps: true });

export const SavedDesign = mongoose.model('SavedDesign', savedDesignSchema);
