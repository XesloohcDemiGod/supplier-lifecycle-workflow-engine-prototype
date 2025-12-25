/**
 * Supplier 360 Profile Model
 * Comprehensive view of supplier including profile, lifecycle state, and audit trail
 */

const { v4: uuidv4 } = require('uuid');
const { STATES } = require('./state-machine');

class Supplier360Profile {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.companyName = data.companyName || '';
    this.contactEmail = data.contactEmail || '';
    this.contactPhone = data.contactPhone || '';
    this.address = data.address || {};
    this.taxId = data.taxId || '';
    this.businessType = data.businessType || '';
    this.categories = data.categories || [];
    
    // Lifecycle state
    this.currentState = data.currentState || STATES.REQUESTED;
    this.requestedBy = data.requestedBy || '';
    this.requestedDate = data.requestedDate || new Date().toISOString();
    
    // ERP Integration
    this.erpId = data.erpId || null;
    this.erpSyncDate = data.erpSyncDate || null;
    
    // Qualification
    this.qualificationScore = data.qualificationScore || null;
    this.qualificationDate = data.qualificationDate || null;
    this.qualificationNotes = data.qualificationNotes || '';
    
    // Metadata
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    // Audit trail
    this.auditTrail = data.auditTrail || [];
  }

  addAuditEntry(action, user, notes = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      user,
      previousState: this.currentState,
      notes
    };
    this.auditTrail.push(entry);
    this.updatedAt = new Date().toISOString();
  }

  updateState(newState, user, notes = '') {
    const previousState = this.currentState;
    this.currentState = newState;
    this.addAuditEntry(`State transition: ${previousState} -> ${newState}`, user, notes);
  }

  toJSON() {
    return {
      id: this.id,
      companyName: this.companyName,
      contactEmail: this.contactEmail,
      contactPhone: this.contactPhone,
      address: this.address,
      taxId: this.taxId,
      businessType: this.businessType,
      categories: this.categories,
      currentState: this.currentState,
      requestedBy: this.requestedBy,
      requestedDate: this.requestedDate,
      erpId: this.erpId,
      erpSyncDate: this.erpSyncDate,
      qualificationScore: this.qualificationScore,
      qualificationDate: this.qualificationDate,
      qualificationNotes: this.qualificationNotes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      auditTrail: this.auditTrail
    };
  }
}

module.exports = Supplier360Profile;
