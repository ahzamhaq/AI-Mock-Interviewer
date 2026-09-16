const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const demoGuard = require('../middleware/demoGuard');
const { list, create, rename, remove } = require('../controllers/presets.controller');

const router = express.Router();
router.use(protect);

// Reads open on the demo account; writes blocked so demo visitors do not
// pollute or delete each other's saved presets. Not a security issue, but
// noticeably bad UX on a shared account.
router.get('/',       list);
router.post('/',      demoGuard, create);
router.patch('/:id',  demoGuard, rename);
router.delete('/:id', demoGuard, remove);

module.exports = router;
