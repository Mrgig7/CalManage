const express = require('express');
const router = express.Router();
const { search } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/search?q=searchTerm
router.get('/', protect, search);

module.exports = router;
