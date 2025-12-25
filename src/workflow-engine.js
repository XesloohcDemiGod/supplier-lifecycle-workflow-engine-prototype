/**
 * Workflow Engine
 * Manages supplier lifecycle workflows and state transitions
 */

const { SupplierStateMachine, STATES } = require('./state-machine');
const Supplier360Profile = require('./supplier-profile');

class WorkflowEngine {
  constructor() {
    this.stateMachine = new SupplierStateMachine();
    this.suppliers = new Map();
    this.tasks = new Map();
  }

  // Create a new supplier request (Buyer request workflow)
  createSupplierRequest(requestData, requestedBy) {
    const supplier = new Supplier360Profile({
      companyName: requestData.companyName,
      contactEmail: requestData.contactEmail,
      contactPhone: requestData.contactPhone,
      categories: requestData.categories,
      businessType: requestData.businessType,
      requestedBy,
      currentState: STATES.REQUESTED
    });

    supplier.addAuditEntry('Supplier request created', requestedBy, 'Initial buyer request');
    this.suppliers.set(supplier.id, supplier);

    // Create a task for sending registration link
    this.createTask(supplier.id, 'SEND_REGISTRATION_LINK', 
      'Send registration portal link to supplier', requestedBy);

    return supplier;
  }

  // Transition to pending registration
  sendRegistrationInvite(supplierId, user) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.PENDING_REGISTRATION)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.PENDING_REGISTRATION}`);
    }

    supplier.updateState(STATES.PENDING_REGISTRATION, user, 'Registration invitation sent');
    return supplier;
  }

  // Complete supplier registration (Supplier registration portal workflow)
  completeRegistration(supplierId, registrationData) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.REGISTERED)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.REGISTERED}`);
    }

    // Update supplier profile with registration data
    supplier.address = registrationData.address || supplier.address;
    supplier.taxId = registrationData.taxId || supplier.taxId;
    supplier.businessType = registrationData.businessType || supplier.businessType;

    supplier.updateState(STATES.REGISTERED, registrationData.contactEmail, 'Supplier registration completed');

    // Create task for internal review
    this.createTask(supplierId, 'REVIEW_SUPPLIER', 
      'Review supplier registration and documentation', 'system');

    return supplier;
  }

  // Start internal review
  startReview(supplierId, reviewer) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.UNDER_REVIEW)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.UNDER_REVIEW}`);
    }

    supplier.updateState(STATES.UNDER_REVIEW, reviewer, 'Internal review started');
    return supplier;
  }

  // Approve for ERP sync
  approveForERP(supplierId, reviewer, notes) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.APPROVED_FOR_ERP)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.APPROVED_FOR_ERP}`);
    }

    supplier.updateState(STATES.APPROVED_FOR_ERP, reviewer, notes || 'Approved for ERP sync');

    // Create task for ERP sync
    this.createTask(supplierId, 'ERP_SYNC', 
      'Sync supplier to ERP system', 'system');

    return supplier;
  }

  // Start ERP sync
  startERPSync(supplierId, user) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.ERP_SYNC_IN_PROGRESS)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.ERP_SYNC_IN_PROGRESS}`);
    }

    supplier.updateState(STATES.ERP_SYNC_IN_PROGRESS, user, 'ERP sync initiated');
    return supplier;
  }

  // Complete ERP sync
  completeERPSync(supplierId, erpId, user) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.ERP_SYNCED)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.ERP_SYNCED}`);
    }

    supplier.erpId = erpId;
    supplier.erpSyncDate = new Date().toISOString();
    supplier.updateState(STATES.ERP_SYNCED, user, `ERP sync completed. ERP ID: ${erpId}`);

    // Create task for qualification
    this.createTask(supplierId, 'QUALIFY_SUPPLIER', 
      'Begin supplier qualification process', 'system');

    return supplier;
  }

  // Start qualification
  startQualification(supplierId, user) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.UNDER_QUALIFICATION)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.UNDER_QUALIFICATION}`);
    }

    supplier.updateState(STATES.UNDER_QUALIFICATION, user, 'Qualification process started');
    return supplier;
  }

  // Complete qualification (pass)
  qualifySupplier(supplierId, score, user, notes) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.QUALIFIED)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.QUALIFIED}`);
    }

    supplier.qualificationScore = score;
    supplier.qualificationDate = new Date().toISOString();
    supplier.qualificationNotes = notes || '';
    supplier.updateState(STATES.QUALIFIED, user, `Supplier qualified with score: ${score}`);

    return supplier;
  }

  // Complete qualification (fail)
  disqualifySupplier(supplierId, score, user, notes) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.DISQUALIFIED)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.DISQUALIFIED}`);
    }

    supplier.qualificationScore = score;
    supplier.qualificationDate = new Date().toISOString();
    supplier.qualificationNotes = notes || '';
    supplier.updateState(STATES.DISQUALIFIED, user, `Supplier disqualified with score: ${score}. Reason: ${notes}`);

    return supplier;
  }

  // Reject supplier at any stage
  rejectSupplier(supplierId, user, reason) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.REJECTED)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.REJECTED}`);
    }

    supplier.updateState(STATES.REJECTED, user, `Supplier rejected. Reason: ${reason}`);
    return supplier;
  }

  // Deactivate supplier
  deactivateSupplier(supplierId, user, reason) {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (!this.stateMachine.isValidTransition(supplier.currentState, STATES.INACTIVE)) {
      throw new Error(`Invalid transition from ${supplier.currentState} to ${STATES.INACTIVE}`);
    }

    supplier.updateState(STATES.INACTIVE, user, `Supplier deactivated. Reason: ${reason}`);
    return supplier;
  }

  // Get supplier by ID
  getSupplier(supplierId) {
    return this.suppliers.get(supplierId);
  }

  // Get all suppliers
  getAllSuppliers() {
    return Array.from(this.suppliers.values());
  }

  // Get suppliers by state
  getSuppliersByState(state) {
    return Array.from(this.suppliers.values())
      .filter(supplier => supplier.currentState === state);
  }

  // Task management
  createTask(supplierId, taskType, description, assignedTo) {
    const task = {
      id: require('uuid').v4(),
      supplierId,
      taskType,
      description,
      assignedTo,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(task.id, task);
    return task;
  }

  completeTask(taskId, user, notes) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    task.status = 'COMPLETED';
    task.completedBy = user;
    task.completedAt = new Date().toISOString();
    task.notes = notes;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  getTasks(supplierId = null) {
    if (supplierId) {
      return Array.from(this.tasks.values())
        .filter(task => task.supplierId === supplierId);
    }
    return Array.from(this.tasks.values());
  }

  getPendingTasks() {
    return Array.from(this.tasks.values())
      .filter(task => task.status === 'PENDING');
  }
}

module.exports = WorkflowEngine;
