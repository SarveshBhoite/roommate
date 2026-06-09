import mongoose from 'mongoose';

const ContributionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  splits: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shareAmount: { type: Number, required: true },
    status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null }
  }]
}, {
  timestamps: true
});

export const Contribution = mongoose.models.Contribution || mongoose.model('Contribution', ContributionSchema);
