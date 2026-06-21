const express = require('express');
const Experiment = require('../models/Experiment');
const asyncHandler = require('../middleware/asyncHandler');
const LRUCache = require('../utils/LRUCache');

const router = express.Router();

// Experiments are read on nearly every page load but change rarely, so they are
// the ideal thing to cache in memory. This LRU cache (hash map + doubly linked
// list, O(1) get/set) absorbs the vast majority of reads, keeping MongoDB load
// flat even at millions of users. Entries expire after 5 minutes so edits to the
// DB still propagate without a restart.
const cache = new LRUCache({ capacity: 200, ttlMs: 5 * 60 * 1000 });

// GET /api/experiments — list all experiments (lightweight: no reaction data).
// Supports optional ?subject=chemistry and ?search=titration query params.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const subject = (req.query.subject || 'all').toLowerCase();
    const search = (req.query.search || '').trim().toLowerCase();
    const cacheKey = `list:${subject}:${search}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const filter = {};
    if (subject !== 'all') filter.subject = subject;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const experiments = await Experiment.find(filter)
      .select('title subject difficulty description estimatedTime')
      .sort({ subject: 1, difficulty: 1 })
      .lean();

    // Map _id -> id for a friendlier frontend shape.
    const payload = experiments.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
    cache.set(cacheKey, payload);
    res.json(payload);
  })
);

// GET /api/experiments/:id — full experiment data (chemicals, steps, reactions).
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cacheKey = `one:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const experiment = await Experiment.findById(req.params.id).lean();
    if (!experiment) return res.status(404).json({ error: 'Experiment not found.' });

    const { _id, ...rest } = experiment;
    const payload = { id: _id, ...rest };
    cache.set(cacheKey, payload);
    res.json(payload);
  })
);

// Exposed so the seed script / admin tooling can flush the cache after writes.
router.cache = cache;

module.exports = router;
