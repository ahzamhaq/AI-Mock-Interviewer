const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { list, create, rename, remove } = require('../controllers/presets.controller');

const router = express.Router();
router.use(protect);

router.get('/',     list);
router.post('/',    create);
router.patch('/:id', rename);
router.delete('/:id', remove);

module.exports = router;
