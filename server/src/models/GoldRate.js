import mongoose from 'mongoose';
const { Schema } = mongoose;

const goldRateSchema = new Schema({
  date: { type: String, required: true, index: true },     // YYYY-MM-DD (IST)
  rates: {                                                  // INR per gram
    '24K': Number, '22K': Number, '18K': Number, '14K': Number,
    platinum: Number, silver: Number,
  },
  source: { type: String, enum: ['api', 'manual', 'seed'], default: 'api' },
  setBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
goldRateSchema.index({ createdAt: -1 });

export const GoldRate = mongoose.model('GoldRate', goldRateSchema);
