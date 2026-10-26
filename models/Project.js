const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['active', 'completed', 'on-hold'], default: 'active' },
    deadline: Date,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
