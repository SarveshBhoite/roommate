import mongoose from 'mongoose';

const ChoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  originalRotationOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rotationOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  currentIndex: { type: Number, default: 0 },
  debts: [{
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

export const Chore = mongoose.models.Chore || mongoose.model('Chore', ChoreSchema);
