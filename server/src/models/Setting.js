import mongoose from 'mongoose';
const { Schema } = mongoose;

// Singleton-style key/value store: gst, extras, size factors, CMS banners/testimonials...
const settingSchema = new Schema({
  key: { type: String, unique: true, required: true },
  value: Schema.Types.Mixed,
}, { timestamps: true });

export const Setting = mongoose.model('Setting', settingSchema);
