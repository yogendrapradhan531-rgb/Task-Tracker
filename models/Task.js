const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Task title is required'], trim: true, maxlength: [100, 'Title cannot exceed 100 characters'] },
    description: { type: String, trim: true, maxlength: [500, 'Description cannot exceed 500 characters'], default: '' },
    status: {
      type: String,
      enum: { values: ['pending', 'in-progress', 'completed'], message: 'Invalid status' },
      default: 'pending',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 20 }],
    subtasks: [{ text: { type: String, trim: true, required: true, maxlength: 100 }, done: { type: Boolean, default: false } }],
    comments: [{ text: { type: String, trim: true, required: true, maxlength: 300 }, createdAt: { type: Date, default: Date.now } }],
    dueDate: Date,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Task must belong to a user'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
