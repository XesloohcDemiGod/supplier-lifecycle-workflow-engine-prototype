/**
 * REST API Routes
 * Exposes endpoints for supplier lifecycle management
 */

const express = require('express');
const WorkflowEngine = require('./workflow-engine');
const { STATES } = require('./state-machine');

const router = express.Router();
const workflowEngine = new WorkflowEngine();

// Buyer Request Workflow APIs

// POST /api/suppliers/request - Create a new supplier request
router.post('/suppliers/request', (req, res) => {
  try {
    const { companyName, contactEmail, contactPhone, categories, businessType, requestedBy } = req.body;
    
    if (!companyName || !contactEmail || !requestedBy) {
      return res.status(400).json({ error: 'Missing required fields: companyName, contactEmail, requestedBy' });
    }

    const supplier = workflowEngine.createSupplierRequest({
      companyName,
      contactEmail,
      contactPhone,
      categories,
      businessType
    }, requestedBy);

    res.status(201).json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/send-invite - Send registration invitation
router.post('/suppliers/:id/send-invite', (req, res) => {
  try {
    const { user } = req.body;
    if (!user) {
      return res.status(400).json({ error: 'Missing required field: user' });
    }

    const supplier = workflowEngine.sendRegistrationInvite(req.params.id, user);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supplier Registration Portal APIs

// POST /api/suppliers/:id/register - Complete supplier registration
router.post('/suppliers/:id/register', (req, res) => {
  try {
    const { address, taxId, businessType, contactEmail } = req.body;
    
    if (!contactEmail) {
      return res.status(400).json({ error: 'Missing required field: contactEmail' });
    }

    const supplier = workflowEngine.completeRegistration(req.params.id, {
      address,
      taxId,
      businessType,
      contactEmail
    });

    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Internal Review APIs

// POST /api/suppliers/:id/review - Start internal review
router.post('/suppliers/:id/review', (req, res) => {
  try {
    const { reviewer } = req.body;
    if (!reviewer) {
      return res.status(400).json({ error: 'Missing required field: reviewer' });
    }

    const supplier = workflowEngine.startReview(req.params.id, reviewer);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/approve - Approve for ERP sync
router.post('/suppliers/:id/approve', (req, res) => {
  try {
    const { reviewer, notes } = req.body;
    if (!reviewer) {
      return res.status(400).json({ error: 'Missing required field: reviewer' });
    }

    const supplier = workflowEngine.approveForERP(req.params.id, reviewer, notes);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/reject - Reject supplier
router.post('/suppliers/:id/reject', (req, res) => {
  try {
    const { user, reason } = req.body;
    if (!user || !reason) {
      return res.status(400).json({ error: 'Missing required fields: user, reason' });
    }

    const supplier = workflowEngine.rejectSupplier(req.params.id, user, reason);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ERP Sync APIs

// POST /api/suppliers/:id/erp-sync/start - Start ERP sync
router.post('/suppliers/:id/erp-sync/start', (req, res) => {
  try {
    const { user } = req.body;
    if (!user) {
      return res.status(400).json({ error: 'Missing required field: user' });
    }

    const supplier = workflowEngine.startERPSync(req.params.id, user);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/erp-sync/complete - Complete ERP sync
router.post('/suppliers/:id/erp-sync/complete', (req, res) => {
  try {
    const { erpId, user } = req.body;
    if (!erpId || !user) {
      return res.status(400).json({ error: 'Missing required fields: erpId, user' });
    }

    const supplier = workflowEngine.completeERPSync(req.params.id, erpId, user);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Qualification APIs

// POST /api/suppliers/:id/qualification/start - Start qualification
router.post('/suppliers/:id/qualification/start', (req, res) => {
  try {
    const { user } = req.body;
    if (!user) {
      return res.status(400).json({ error: 'Missing required field: user' });
    }

    const supplier = workflowEngine.startQualification(req.params.id, user);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/qualification/qualify - Qualify supplier
router.post('/suppliers/:id/qualification/qualify', (req, res) => {
  try {
    const { score, user, notes } = req.body;
    if (score === undefined || !user) {
      return res.status(400).json({ error: 'Missing required fields: score, user' });
    }

    const supplier = workflowEngine.qualifySupplier(req.params.id, score, user, notes);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/qualification/disqualify - Disqualify supplier
router.post('/suppliers/:id/qualification/disqualify', (req, res) => {
  try {
    const { score, user, notes } = req.body;
    if (score === undefined || !user) {
      return res.status(400).json({ error: 'Missing required fields: score, user' });
    }

    const supplier = workflowEngine.disqualifySupplier(req.params.id, score, user, notes);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/:id/deactivate - Deactivate supplier
router.post('/suppliers/:id/deactivate', (req, res) => {
  try {
    const { user, reason } = req.body;
    if (!user || !reason) {
      return res.status(400).json({ error: 'Missing required fields: user, reason' });
    }

    const supplier = workflowEngine.deactivateSupplier(req.params.id, user, reason);
    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supplier 360 Profile APIs

// GET /api/suppliers - Get all suppliers
router.get('/suppliers', (req, res) => {
  try {
    const { state } = req.query;
    let suppliers;
    
    if (state) {
      suppliers = workflowEngine.getSuppliersByState(state);
    } else {
      suppliers = workflowEngine.getAllSuppliers();
    }

    res.json({
      success: true,
      count: suppliers.length,
      suppliers: suppliers.map(s => s.toJSON())
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/suppliers/:id - Get supplier 360 profile
router.get('/suppliers/:id', (req, res) => {
  try {
    const supplier = workflowEngine.getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({
      success: true,
      supplier: supplier.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Task Management APIs

// GET /api/tasks - Get all tasks (optionally filtered by supplier)
router.get('/tasks', (req, res) => {
  try {
    const { supplierId, status } = req.query;
    let tasks = workflowEngine.getTasks(supplierId);

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
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/tasks/:id/complete - Complete a task
router.post('/tasks/:id/complete', (req, res) => {
  try {
    const { user, notes } = req.body;
    if (!user) {
      return res.status(400).json({ error: 'Missing required field: user' });
    }

    const task = workflowEngine.completeTask(req.params.id, user, notes);
    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/states - Get all available states
router.get('/states', (req, res) => {
  res.json({
    success: true,
    states: Object.values(STATES)
  });
});

module.exports = router;
