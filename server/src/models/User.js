import mongoose from 'mongoose';
const { Schema } = mongoose;

const addressSchema = new Schema({
  label: String, name: String, phone: String,
  line1: String, line2: String, city: String, state: String, pincode: String,
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema({
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  mobile: { type: String, trim: true, unique: true, sparse: true },
  passwordHash: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['customer', 'designer', 'admin'], default: 'customer', index: true },
  savedRingSize: String,
  addresses: [addressSchema],
  wishlist: [{ type: Schema.Types.ObjectId, ref: 'Design' }],
  otp: {
    type: new Schema({ hash: String, expiresAt: Date, attempts: { type: Number, default: 0 } }, { _id: false }),
    select: false,
  },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },      // bump to revoke every issued token (password change, role change, deactivation)
  failedLogins: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
