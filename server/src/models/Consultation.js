import mongoose from 'mongoose';
const { Schema } = mongoose;

const consultationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  request: { type: Schema.Types.ObjectId, ref: 'CustomRequest' },
  mode: { type: String, enum: ['video', 'store'], required: true },
  date: { type: String, required: true },                  // YYYY-MM-DD
  slot: { type: String, required: true },                  // "11:00-11:30"
  status: { type: String, enum: ['booked', 'confirmed', 'completed', 'cancelled'], default: 'booked' },
  assignedDesigner: { type: Schema.Types.ObjectId, ref: 'User' },
  meetingLink: String,
}, { timestamps: true });
// A designer cannot be double-booked; unassigned bookings are capped via capacity check in the route.
consultationSchema.index({ date: 1, slot: 1 });

export const Consultation = mongoose.model('Consultation', consultationSchema);
