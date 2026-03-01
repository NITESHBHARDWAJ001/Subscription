const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['manual', 'credit_card', 'bank_transfer', 'paypal', 'stripe'],
    default: 'manual'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true  // Allows multiple null values
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  // For manual payments by admin
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  },
  // Invoice details
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for quick lookups
paymentSchema.index({ organizationId: 1, status: 1 });
paymentSchema.index({ subscriptionId: 1 });
paymentSchema.index({ status: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
