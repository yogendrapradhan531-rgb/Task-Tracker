const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { getTasks, getStats, createTask, updateTask, deleteTask, addComment, bulkAction } = require('../controllers/taskController');

router.use(protect);
router.get('/stats', getStats);      // fixed paths must come before /:id
router.post('/bulk', bulkAction);
router.route('/').get(getTasks).post(createTask);
router.route('/:id').put(updateTask).delete(deleteTask);
router.post('/:id/comments', addComment);

module.exports = router;
