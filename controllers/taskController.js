const Task = require('../models/Task');
const Project = require('../models/Project');
const handleError = require('../utils/handleError');

const FIELDS = ['title', 'description', 'status', 'priority', 'tags', 'subtasks', 'dueDate', 'project'];
const pick = (body) => {
  const out = Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  if (out.project === '') out.project = null;
  if (out.dueDate === '') out.dueDate = null;
  return out;
};
const ownsProject = async (req, id) => !id || !!(await Project.exists({ _id: id, user: req.user._id }));

// GET /api/tasks?status=&priority=&project=&tag=&search=&sort=&order=&page=&limit=
const getTasks = async (req, res) => {
  try {
    const { status, priority, project, tag, search } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (project) filter.project = project;
    if (tag) filter.tags = tag.toLowerCase();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { description: re }];
    }
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const sortBy = ['createdAt', 'dueDate', 'title'].includes(req.query.sort) ? req.query.sort : 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      Task.find(filter).populate('project', 'name').sort({ [sortBy]: order }).skip((page - 1) * limit).limit(limit),
      Task.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), data });
  } catch (e) { handleError(res, e); }
};

// GET /api/tasks/stats: dashboard counts and chart data
const getStats = async (req, res) => {
  try {
    const base = { user: req.user._id };
    const count = (extra) => Task.countDocuments({ ...base, ...extra });
    const since = new Date(); since.setUTCHours(0, 0, 0, 0); since.setUTCDate(since.getUTCDate() - 6);
    const [total, pending, inProgress, completed, overdue, pri, days] = await Promise.all([
      count({}), count({ status: 'pending' }), count({ status: 'in-progress' }), count({ status: 'completed' }),
      count({ status: { $ne: 'completed' }, dueDate: { $lt: new Date() } }),
      Task.aggregate([{ $match: base }, { $group: { _id: '$priority', n: { $sum: 1 } } }]),
      Task.aggregate([
        { $match: { ...base, status: 'completed', updatedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, n: { $sum: 1 } } },
      ]),
    ]);
    const byPriority = { low: 0, medium: 0, high: 0 };
    pri.forEach((p) => { byPriority[p._id] = p.n; });
    const dayMap = Object.fromEntries(days.map((d) => [d._id, d.n]));
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since); d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, count: dayMap[key] || 0 };
    });
    res.status(200).json({ success: true, data: { total, pending, inProgress, completed, overdue, byPriority, last7 } });
  } catch (e) { handleError(res, e); }
};

const createTask = async (req, res) => {
  try {
    const body = pick(req.body);
    if (!(await ownsProject(req, body.project))) return res.status(404).json({ success: false, message: 'Project not found' });
    const task = await Task.create({ ...body, user: req.user._id });
    res.status(201).json({ success: true, data: task });
  } catch (e) { handleError(res, e); }
};

const updateTask = async (req, res) => {
  try {
    const body = pick(req.body);
    if (!(await ownsProject(req, body.project))) return res.status(404).json({ success: false, message: 'Project not found' });
    const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.status(200).json({ success: true, data: task });
  } catch (e) { handleError(res, e); }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (e) { handleError(res, e); }
};

// POST /api/tasks/:id/comments
const addComment = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Comment text is required' });
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $push: { comments: { text } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.status(201).json({ success: true, data: task });
  } catch (e) { handleError(res, e); }
};

// POST /api/tasks/bulk  body: { ids: [], action: 'complete' | 'delete' }
const bulkAction = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ids array is required' });
    const filter = { _id: { $in: ids }, user: req.user._id };
    if (action === 'complete') await Task.updateMany(filter, { status: 'completed' });
    else if (action === 'delete') await Task.deleteMany(filter);
    else return res.status(400).json({ success: false, message: 'Invalid action' });
    res.status(200).json({ success: true, message: 'Done' });
  } catch (e) { handleError(res, e); }
};

module.exports = { getTasks, getStats, createTask, updateTask, deleteTask, addComment, bulkAction };
