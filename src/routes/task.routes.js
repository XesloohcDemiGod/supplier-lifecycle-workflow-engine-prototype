/**
 * Task Routes
 * API endpoints for task management
 */

const express = require('express');
const WorkflowEngineDB = require('../workflow-engine-db');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../middleware/validation.middleware');
const { taskSchemas, querySchemas } = require('../validators/schemas');
const { asyncHandler } = require('../middleware/error.middleware');

const router = express.Router();
const workflowEngine = new WorkflowEngineDB();

/**
 * GET /api/tasks - Get all tasks (optionally filtered by supplier or status)
 * Requires: Authentication
 */
router.get(
  '/',
  authenticate,
  validateQuery(querySchemas.taskStatus),
  asyncHandler(async (req, res) => {
    const { supplierId, status } = req.query;

    let tasks = await workflowEngine.getTasks(supplierId);

    if (status === 'PENDING') {
      tasks = tasks.filter(t => t.status === 'PENDING');
    } else if (status === 'COMPLETED') {
      tasks = tasks.filter(t => t.status === 'COMPLETED');
    }

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  })
);

/**
 * POST /api/tasks/:id/complete - Complete a task
 * Requires: Authentication
 */
router.post(
  '/:id/complete',
  authenticate,
  validateBody(taskSchemas.complete),
  asyncHandler(async (req, res) => {
    const { notes } = req.body;

    const task = await workflowEngine.completeTask(
      req.params.id,
      req.user.username,
      notes
    );

    res.json({
      success: true,
      task
    });
  })
);

module.exports = router;
