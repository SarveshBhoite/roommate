import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  message: { type: String, default: '' },
  imageUrl: { type: String, default: null }
}, {
  timestamps: true
});

export const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
