const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createFromUrl,
  createFromGithub,
  listProjects,
  getProject,
  reanalyzeProject,
  deleteProject,
} = require('../controllers/project.controller');

const router = express.Router();

// Every project route is per-user; require auth.
router.use(protect);

router.get('/',   listProjects);
router.post('/from-url',    createFromUrl);
router.post('/from-github', createFromGithub);
router.get('/:id',          getProject);
router.post('/:id/reanalyze', reanalyzeProject);
router.delete('/:id',       deleteProject);

module.exports = router;
