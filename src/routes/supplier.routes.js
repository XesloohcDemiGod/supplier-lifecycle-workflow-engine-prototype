/**
 * Supplier Routes
 * RESTful API for supplier lifecycle management with auth and validation
 */

const express = require('express');
const WorkflowEngineDB = require('../workflow-engine-db');
const SupplierModel = require('../database/models/supplier.model');
const AuditTrailModel = require('../database/models/audit-trail.model');
const { STATES } = require('../state-machine');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../middleware/validation.middleware');
const { supplierSchemas, querySchemas } = require('../validators/schemas');
const { asyncHandler } = require('../middleware/error.middleware');

const router = express.Router();
const workflowEngine = new WorkflowEngineDB();

/**
 * POST /api/suppliers/request - Create a new supplier request
 * Requires: Buyer role
 */
router.post(
  '/request',
  authenticate,
  authorize('Buyer'),
  validateBody(supplierSchemas.createRequest),
  asyncHandler(async (req, res) => {
    const { companyName, contactEmail, contactPhone, categories, businessType } = req.body;

    const supplier = await workflowEngine.createSupplierRequest(
      {
        companyName,
        contactEmail,
        contactPhone,
        categories,
        businessType
      },
      req.user.username
    );

    res.status(201).json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/send-invite - Send registration invitation
 * Requires: Buyer role
 */
router.post(
  '/:id/send-invite',
  authenticate,
  authorize('Buyer'),
  asyncHandler(async (req, res) => {
    const supplier = await workflowEngine.sendRegistrationInvite(req.params.id, req.user.username);

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/register - Complete supplier registration
 * Requires: Supplier role or no auth (public for suppliers to register)
 */
router.post(
  '/:id/register',
  validateBody(supplierSchemas.register),
  asyncHandler(async (req, res) => {
    const { address, taxId, businessType, contactEmail } = req.body;

    const supplier = await workflowEngine.completeRegistration(req.params.id, {
      address,
      taxId,
      businessType,
      contactEmail
    });

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/review - Start internal review
 * Requires: Reviewer role
 */
router.post(
  '/:id/review',
  authenticate,
  authorize('Reviewer'),
  validateBody(supplierSchemas.review),
  asyncHandler(async (req, res) => {
    const supplier = await workflowEngine.startReview(req.params.id, req.user.username);

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/approve - Approve for ERP sync
 * Requires: Reviewer or Finance role
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize('Reviewer', 'Finance'),
  validateBody(supplierSchemas.approve),
  asyncHandler(async (req, res) => {
    const { notes } = req.body;

    const supplier = await workflowEngine.approveForERP(
      req.params.id,
      req.user.username,
      notes
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/reject - Reject supplier
 * Requires: Reviewer or Admin role
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize('Reviewer', 'Admin'),
  validateBody(supplierSchemas.reject),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const supplier = await workflowEngine.rejectSupplier(
      req.params.id,
      req.user.username,
      reason
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/erp-sync/start - Start ERP sync
 * Requires: Finance role
 */
router.post(
  '/:id/erp-sync/start',
  authenticate,
  authorize('Finance'),
  validateBody(supplierSchemas.erpSyncStart),
  asyncHandler(async (req, res) => {
    const supplier = await workflowEngine.startERPSync(req.params.id, req.user.username);

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/erp-sync/complete - Complete ERP sync
 * Requires: Finance role
 */
router.post(
  '/:id/erp-sync/complete',
  authenticate,
  authorize('Finance'),
  validateBody(supplierSchemas.erpSyncComplete),
  asyncHandler(async (req, res) => {
    const { erpId } = req.body;

    const supplier = await workflowEngine.completeERPSync(
      req.params.id,
      erpId,
      req.user.username
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/qualification/start - Start qualification
 * Requires: Reviewer role
 */
router.post(
  '/:id/qualification/start',
  authenticate,
  authorize('Reviewer'),
  validateBody(supplierSchemas.qualificationStart),
  asyncHandler(async (req, res) => {
    const supplier = await workflowEngine.startQualification(req.params.id, req.user.username);

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/qualification/qualify - Qualify supplier
 * Requires: Reviewer role
 */
router.post(
  '/:id/qualification/qualify',
  authenticate,
  authorize('Reviewer'),
  validateBody(supplierSchemas.qualify),
  asyncHandler(async (req, res) => {
    const { score, notes } = req.body;

    const supplier = await workflowEngine.qualifySupplier(
      req.params.id,
      score,
      req.user.username,
      notes
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/qualification/disqualify - Disqualify supplier
 * Requires: Reviewer role
 */
router.post(
  '/:id/qualification/disqualify',
  authenticate,
  authorize('Reviewer'),
  validateBody(supplierSchemas.disqualify),
  asyncHandler(async (req, res) => {
    const { score, notes } = req.body;

    const supplier = await workflowEngine.disqualifySupplier(
      req.params.id,
      score,
      req.user.username,
      notes
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * POST /api/suppliers/:id/deactivate - Deactivate supplier
 * Requires: Admin role
 */
router.post(
  '/:id/deactivate',
  authenticate,
  authorize('Admin'),
  validateBody(supplierSchemas.deactivate),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const supplier = await workflowEngine.deactivateSupplier(
      req.params.id,
      req.user.username,
      reason
    );

    res.json({
      success: true,
      supplier
    });
  })
);

/**
 * GET /api/suppliers - Get all suppliers (with optional state filter)
 * Requires: Authentication
 */
router.get(
  '/',
  authenticate,
  validateQuery(querySchemas.supplierState),
  asyncHandler(async (req, res) => {
    const { state } = req.query;

    let suppliers;
    if (state) {
      suppliers = await workflowEngine.getSuppliersByState(state);
    } else {
      suppliers = await workflowEngine.getAllSuppliers();
    }

    res.json({
      success: true,
      count: suppliers.length,
      suppliers
    });
  })
);

/**
 * GET /api/suppliers/:id - Get supplier 360 profile
 * Requires: Authentication
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const supplier = await workflowEngine.getSupplier(req.params.id);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({
      success: true,
      supplier
    });
  })
);

module.exports = router;
