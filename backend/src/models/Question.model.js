const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ['technical', 'hr', 'behavioral', 'system_design'],
    required: true,
  },
  role: {
    type: String,
    enum: ['frontend_developer', 'backend_developer', 'fullstack_developer', 'sde', 'data_analyst', 'hr', 'general', 'other'],
    default: 'general',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  experienceLevel: {
    type: String,
    enum: ['fresher', '1-2_years', '3+_years', 'all'],
    default: 'all',
  },
  companyType: [{ type: String, enum: ['faang', 'startup', 'service_based', 'product_based', 'any'] }],
  targetCompany: { type: String, default: '' },
  tags: [String],
  sampleAnswer: { type: String, default: '' },
  followUpQuestions: [String],
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

questionSchema.index({ role: 1, type: 1, difficulty: 1 });
questionSchema.index({ tags: 1 });

const Question = mongoose.model('Question', questionSchema);
module.exports = Question;
