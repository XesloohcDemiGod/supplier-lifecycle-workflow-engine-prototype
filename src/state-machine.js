/**
 * Supplier Lifecycle State Machine
 * 
 * 12 States:
 * 1. REQUESTED - Initial buyer request
 * 2. PENDING_REGISTRATION - Awaiting supplier to register
 * 3. REGISTERED - Supplier has registered
 * 4. UNDER_REVIEW - Internal review in progress
 * 5. APPROVED_FOR_ERP - Review passed, ready for ERP sync
 * 6. ERP_SYNC_IN_PROGRESS - Syncing to ERP system
 * 7. ERP_SYNCED - Successfully synced to ERP
 * 8. UNDER_QUALIFICATION - Qualification process in progress
 * 9. QUALIFIED - Supplier is qualified
 * 10. DISQUALIFIED - Supplier failed qualification
 * 11. REJECTED - Rejected during review
 * 12. INACTIVE - Supplier deactivated
 */

const STATES = {
  REQUESTED: 'REQUESTED',
  PENDING_REGISTRATION: 'PENDING_REGISTRATION',
  REGISTERED: 'REGISTERED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED_FOR_ERP: 'APPROVED_FOR_ERP',
  ERP_SYNC_IN_PROGRESS: 'ERP_SYNC_IN_PROGRESS',
  ERP_SYNCED: 'ERP_SYNCED',
  UNDER_QUALIFICATION: 'UNDER_QUALIFICATION',
  QUALIFIED: 'QUALIFIED',
  DISQUALIFIED: 'DISQUALIFIED',
  REJECTED: 'REJECTED',
  INACTIVE: 'INACTIVE'
};

const TRANSITIONS = {
  [STATES.REQUESTED]: [STATES.PENDING_REGISTRATION, STATES.REJECTED],
  [STATES.PENDING_REGISTRATION]: [STATES.REGISTERED, STATES.REJECTED],
  [STATES.REGISTERED]: [STATES.UNDER_REVIEW, STATES.REJECTED],
  [STATES.UNDER_REVIEW]: [STATES.APPROVED_FOR_ERP, STATES.REJECTED],
  [STATES.APPROVED_FOR_ERP]: [STATES.ERP_SYNC_IN_PROGRESS, STATES.REJECTED],
  [STATES.ERP_SYNC_IN_PROGRESS]: [STATES.ERP_SYNCED, STATES.REJECTED],
  [STATES.ERP_SYNCED]: [STATES.UNDER_QUALIFICATION],
  [STATES.UNDER_QUALIFICATION]: [STATES.QUALIFIED, STATES.DISQUALIFIED],
  [STATES.QUALIFIED]: [STATES.INACTIVE],
  [STATES.DISQUALIFIED]: [STATES.INACTIVE],
  [STATES.REJECTED]: [STATES.INACTIVE],
  [STATES.INACTIVE]: []
};

class SupplierStateMachine {
  constructor() {
    this.states = STATES;
  }

  isValidTransition(currentState, newState) {
    const allowedTransitions = TRANSITIONS[currentState] || [];
    return allowedTransitions.includes(newState);
  }

  getAvailableTransitions(currentState) {
    return TRANSITIONS[currentState] || [];
  }

  getAllStates() {
    return Object.values(STATES);
  }
}

module.exports = {
  STATES,
  TRANSITIONS,
  SupplierStateMachine
};
