import mongoose from 'mongoose';

const SwapRequestSchema = new mongoose.Schema({
  choreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chore', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, {
  timestamps: true
});

export const SwapRequest = mongoose.models.SwapRequest || mongoose.model('SwapRequest', SwapRequestSchema);
