/**
 * Database-backed Workflow Engine
 * Manages supplier lifecycle workflows with persistent storage
 */

const { SupplierStateMachine, STATES } = require('./state-machine');
const SupplierModel = require('./database/models/supplier.model');
const AuditTrailModel = require('./database/models/audit-trail.model');
const TaskModel = require('./database/models/task.model');
const { InvalidStateTransitionError, NotFoundError } = require('./middleware/error.middleware');
const logger = require('./utils/logger');

class WorkflowEngineDB {
  constructor() {
    this.stateMachine = new SupplierStateMachine();
  }

  /**
   * Create a new supplier request (Buyer request workflow)
   */
  async createSupplierRequest(requestData, requestedBy) {
    const supplier = await SupplierModel.create({
      companyName: requestData.companyName,
      contactEmail: requestData.contactEmail,
      contactPhone: requestData.contactPhone,
      categories: requestData.categories,
      businessType: requestData.businessType,
      requestedBy,
      currentState: STATES.REQUESTED
    });

    // Add audit entry
    await AuditTrailModel.create({
      supplierId: supplier.id,
      action: 'Supplier request created',
      user: requestedBy,
      notes: 'Initial buyer request'
    });

    // Create a task for sending registration link
    await TaskModel.create({
      supplierId: supplier.id,
      taskType: 'SEND_REGISTRATION_LINK',
      description: 'Send registration portal link to supplier',
      assignedTo: requestedBy
    });

    return supplier;
  }

  /**
   * Transition to pending registration
   */
  async sendRegistrationInvite(supplierId, user) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.PENDING_REGISTRATION)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.PENDING_REGISTRATION);
    }

    await SupplierModel.updateState(supplierId, STATES.PENDING_REGISTRATION);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.PENDING_REGISTRATION}`,
      user,
      previousState: supplier.currentState,
      notes: 'Registration invitation sent'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Complete supplier registration
   */
  async completeRegistration(supplierId, registrationData) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.REGISTERED)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.REGISTERED);
    }

    // Update supplier profile with registration data
    await SupplierModel.update(supplierId, {
      contactEmail: registrationData.contactEmail,
      taxId: registrationData.taxId,
      businessType: registrationData.businessType,
      address: registrationData.address
    });

    await SupplierModel.updateState(supplierId, STATES.REGISTERED);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.REGISTERED}`,
      user: registrationData.contactEmail,
      previousState: supplier.currentState,
      notes: 'Supplier registration completed'
    });

    // Create task for internal review
    await TaskModel.create({
      supplierId,
      taskType: 'REVIEW_SUPPLIER',
      description: 'Review supplier registration and documentation',
      assignedTo: 'system'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Start internal review
   */
  async startReview(supplierId, reviewer) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.UNDER_REVIEW)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.UNDER_REVIEW);
    }

    await SupplierModel.updateState(supplierId, STATES.UNDER_REVIEW);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.UNDER_REVIEW}`,
      user: reviewer,
      previousState: supplier.currentState,
      notes: 'Internal review started'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Approve for ERP sync
   */
  async approveForERP(supplierId, reviewer, notes = '') {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.APPROVED_FOR_ERP)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.APPROVED_FOR_ERP);
    }

    await SupplierModel.updateState(supplierId, STATES.APPROVED_FOR_ERP);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.APPROVED_FOR_ERP}`,
      user: reviewer,
      previousState: supplier.currentState,
      notes: notes || 'Approved for ERP sync'
    });

    // Create task for ERP sync
    await TaskModel.create({
      supplierId,
      taskType: 'ERP_SYNC',
      description: 'Sync supplier to ERP system',
      assignedTo: 'system'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Start ERP sync
   */
  async startERPSync(supplierId, user) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.ERP_SYNC_IN_PROGRESS)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.ERP_SYNC_IN_PROGRESS);
    }

    await SupplierModel.updateState(supplierId, STATES.ERP_SYNC_IN_PROGRESS);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.ERP_SYNC_IN_PROGRESS}`,
      user,
      previousState: supplier.currentState,
      notes: 'ERP sync initiated'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Complete ERP sync
   */
  async completeERPSync(supplierId, erpId, user) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.ERP_SYNCED)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.ERP_SYNCED);
    }

    const now = new Date().toISOString();
    await SupplierModel.update(supplierId, {
      erpId,
      erpSyncDate: now
    });

    await SupplierModel.updateState(supplierId, STATES.ERP_SYNCED);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.ERP_SYNCED}`,
      user,
      previousState: supplier.currentState,
      notes: `ERP sync completed. ERP ID: ${erpId}`
    });

    // Create task for qualification
    await TaskModel.create({
      supplierId,
      taskType: 'QUALIFY_SUPPLIER',
      description: 'Begin supplier qualification process',
      assignedTo: 'system'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Start qualification
   */
  async startQualification(supplierId, user) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.UNDER_QUALIFICATION)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.UNDER_QUALIFICATION);
    }

    await SupplierModel.updateState(supplierId, STATES.UNDER_QUALIFICATION);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.UNDER_QUALIFICATION}`,
      user,
      previousState: supplier.currentState,
      notes: 'Qualification process started'
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Complete qualification (pass)
   */
  async qualifySupplier(supplierId, score, user, notes = '') {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.QUALIFIED)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.QUALIFIED);
    }

    const now = new Date().toISOString();
    await SupplierModel.update(supplierId, {
      qualificationScore: score,
      qualificationDate: now,
      qualificationNotes: notes
    });

    await SupplierModel.updateState(supplierId, STATES.QUALIFIED);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.QUALIFIED}`,
      user,
      previousState: supplier.currentState,
      notes: `Supplier qualified with score: ${score}`
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Complete qualification (fail)
   */
  async disqualifySupplier(supplierId, score, user, notes) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.DISQUALIFIED)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.DISQUALIFIED);
    }

    const now = new Date().toISOString();
    await SupplierModel.update(supplierId, {
      qualificationScore: score,
      qualificationDate: now,
      qualificationNotes: notes
    });

    await SupplierModel.updateState(supplierId, STATES.DISQUALIFIED);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.DISQUALIFIED}`,
      user,
      previousState: supplier.currentState,
      notes: `Supplier disqualified with score: ${score}. Reason: ${notes}`
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Reject supplier at any stage
   */
  async rejectSupplier(supplierId, user, reason) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.REJECTED)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.REJECTED);
    }

    await SupplierModel.updateState(supplierId, STATES.REJECTED);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.REJECTED}`,
      user,
      previousState: supplier.currentState,
      notes: `Supplier rejected. Reason: ${reason}`
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Deactivate supplier
   */
  async deactivateSupplier(supplierId, user, reason) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.INACTIVE)) {
      throw new InvalidStateTransitionError(supplier.currentState, STATES.INACTIVE);
    }

    await SupplierModel.updateState(supplierId, STATES.INACTIVE);
    await AuditTrailModel.create({
      supplierId,
      action: `State transition: ${supplier.currentState} -> ${STATES.INACTIVE}`,
      user,
      previousState: supplier.currentState,
      notes: `Supplier deactivated. Reason: ${reason}`
    });

    return await SupplierModel.findById(supplierId);
  }

  /**
   * Get supplier by ID with audit trail
   */
  async getSupplier(supplierId) {
    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) {
      return null;
    }

    const auditTrail = await AuditTrailModel.findBySupplierId(supplierId);
    return {
      ...supplier,
      auditTrail
    };
  }

  /**
   * Get all suppliers
   */
  async getAllSuppliers() {
    return await SupplierModel.findAll();
  }

  /**
   * Get suppliers by state
   */
  async getSuppliersByState(state) {
    return await SupplierModel.findByState(state);
  }

  /**
   * Get tasks
   */
  async getTasks(supplierId = null) {
    if (supplierId) {
      return await TaskModel.findBySupplierId(supplierId);
    }
    return await TaskModel.findAll();
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks() {
    return await TaskModel.findByStatus('PENDING');
  }

  /**
   * Complete task
   */
  async completeTask(taskId, user, notes = '') {
    const task = await TaskModel.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    return await TaskModel.complete(taskId, user, notes);
  }
}

module.exports = WorkflowEngineDB;
