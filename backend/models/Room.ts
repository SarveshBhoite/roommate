import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  noticeMarquee: { type: String, default: "" },
  upiId: { type: String, default: "" },
  qrCodeUrl: { type: String, default: "" }
}, {
  timestamps: true
});

export const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
