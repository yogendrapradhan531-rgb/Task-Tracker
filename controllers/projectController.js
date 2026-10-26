const Project = require('../models/Project');
const Task = require('../models/Task');
const handleError = require('../utils/handleError');

const pick = (b) =>
  Object.fromEntries(['name', 'description', 'status', 'deadline'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

// GET /api/projects: each project includes task count and % progress
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const counts = await Task.aggregate([
      { $match: { user: req.user._id, project: { $ne: null } } },
      { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    projects.forEach((p) => {
      const c = map[String(p._id)] || { total: 0, done: 0 };
      p.totalTasks = c.total;
      p.progress = c.total ? Math.round((c.done / c.total) * 100) : 0;
    });
    res.status(200).json({ success: true, data: projects });
  } catch (e) { handleError(res, e); }
};

const createProject = async (req, res) => {
  try {
    const project = await Project.create({ ...pick(req.body), user: req.user._id });
    res.status(201).json({ success: true, data: project });
  } catch (e) { handleError(res, e); }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, pick(req.body), { new: true, runValidators: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.status(200).json({ success: true, data: project });
  } catch (e) { handleError(res, e); }
};

// Deleting a project keeps its tasks (they become unassigned)
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    await Task.updateMany({ project: project._id, user: req.user._id }, { project: null });
    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (e) { handleError(res, e); }
};

module.exports = { getProjects, createProject, updateProject, deleteProject };
