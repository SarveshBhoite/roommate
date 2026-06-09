import mongoose from 'mongoose';

const ChoreLogSchema = new mongoose.Schema({
  choreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chore', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  choreName: { type: String, required: true },
  completedAt: { type: Date, default: Date.now }
});

export const ChoreLog = mongoose.models.ChoreLog || mongoose.model('ChoreLog', ChoreLogSchema);
