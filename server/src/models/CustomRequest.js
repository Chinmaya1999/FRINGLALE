import mongoose from 'mongoose';
const { Schema } = mongoose;

const customRequestSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: String,
  description: { type: String, required: true },
  budgetMin: Number, budgetMax: Number,
  files: [String],
  status: { type: String, enum: ['new', 'assigned', 'in_design', 'cad_shared', 'closed'], default: 'new', index: true },
  assignedDesigner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  cadFiles: [String],
  notes: [{ by: { type: Schema.Types.ObjectId, ref: 'User' }, text: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

export const CustomRequest = mongoose.model('CustomRequest', customRequestSchema);
