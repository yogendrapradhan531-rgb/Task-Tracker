const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/projectController');

router.use(protect);
router.route('/').get(getProjects).post(createProject);
router.route('/:id').put(updateProject).delete(deleteProject);

module.exports = router;
