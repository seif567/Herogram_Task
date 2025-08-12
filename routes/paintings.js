const express = require('express');
const { generatePaintings, getPaintings, retryPainting, regeneratePrompt } = require('../controllers/paintingController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

router.post('/generate', generatePaintings);
router.get('/:titleId', getPaintings);

// Retry a failed painting
router.post('/:id/retry', retryPainting);
router.post('/:id/regenerate-prompt', regeneratePrompt);

module.exports = router; 