/**
 * State Machine Unit Tests
 */

const { SupplierStateMachine, STATES, TRANSITIONS } = require('../../src/state-machine');

describe('SupplierStateMachine', () => {
  let stateMachine;

  beforeEach(() => {
    stateMachine = new SupplierStateMachine();
  });

  describe('State Constants', () => {
    test('should have all 12 states defined', () => {
      const stateValues = Object.values(STATES);
      expect(stateValues).toHaveLength(12);
      expect(stateValues).toContain('REQUESTED');
      expect(stateValues).toContain('PENDING_REGISTRATION');
      expect(stateValues).toContain('REGISTERED');
      expect(stateValues).toContain('UNDER_REVIEW');
      expect(stateValues).toContain('APPROVED_FOR_ERP');
      expect(stateValues).toContain('ERP_SYNC_IN_PROGRESS');
      expect(stateValues).toContain('ERP_SYNCED');
      expect(stateValues).toContain('UNDER_QUALIFICATION');
      expect(stateValues).toContain('QUALIFIED');
      expect(stateValues).toContain('DISQUALIFIED');
      expect(stateValues).toContain('REJECTED');
      expect(stateValues).toContain('INACTIVE');
    });
  });

  describe('isValidTransition', () => {
    test('should allow valid transition from REQUESTED to PENDING_REGISTRATION', () => {
      const isValid = stateMachine.isValidTransition(
        STATES.REQUESTED,
        STATES.PENDING_REGISTRATION
      );
      expect(isValid).toBe(true);
    });

    test('should allow valid transition from REQUESTED to REJECTED', () => {
      const isValid = stateMachine.isValidTransition(STATES.REQUESTED, STATES.REJECTED);
      expect(isValid).toBe(true);
    });

    test('should not allow invalid transition from REQUESTED to QUALIFIED', () => {
      const isValid = stateMachine.isValidTransition(STATES.REQUESTED, STATES.QUALIFIED);
      expect(isValid).toBe(false);
    });

    test('should not allow transition from INACTIVE to any state', () => {
      const isValid = stateMachine.isValidTransition(STATES.INACTIVE, STATES.QUALIFIED);
      expect(isValid).toBe(false);
    });

    test('should allow transition through full happy path', () => {
      // Complete workflow path
      expect(
        stateMachine.isValidTransition(STATES.REQUESTED, STATES.PENDING_REGISTRATION)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.PENDING_REGISTRATION, STATES.REGISTERED)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.REGISTERED, STATES.UNDER_REVIEW)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.UNDER_REVIEW, STATES.APPROVED_FOR_ERP)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.APPROVED_FOR_ERP, STATES.ERP_SYNC_IN_PROGRESS)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.ERP_SYNC_IN_PROGRESS, STATES.ERP_SYNCED)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.ERP_SYNCED, STATES.UNDER_QUALIFICATION)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.UNDER_QUALIFICATION, STATES.QUALIFIED)
      ).toBe(true);
      expect(
        stateMachine.isValidTransition(STATES.QUALIFIED, STATES.INACTIVE)
      ).toBe(true);
    });

    test('should allow rejection from most states', () => {
      const rejectableStates = [
        STATES.REQUESTED,
        STATES.PENDING_REGISTRATION,
        STATES.REGISTERED,
        STATES.UNDER_REVIEW,
        STATES.APPROVED_FOR_ERP,
        STATES.ERP_SYNC_IN_PROGRESS
      ];

      rejectableStates.forEach((state) => {
        expect(stateMachine.isValidTransition(state, STATES.REJECTED)).toBe(true);
      });
    });
  });

  describe('getAvailableTransitions', () => {
    test('should return available transitions for REQUESTED state', () => {
      const transitions = stateMachine.getAvailableTransitions(STATES.REQUESTED);
      expect(transitions).toContain(STATES.PENDING_REGISTRATION);
      expect(transitions).toContain(STATES.REJECTED);
      expect(transitions).toHaveLength(2);
    });

    test('should return no transitions for INACTIVE state', () => {
      const transitions = stateMachine.getAvailableTransitions(STATES.INACTIVE);
      expect(transitions).toHaveLength(0);
    });

    test('should return single transition for ERP_SYNCED state', () => {
      const transitions = stateMachine.getAvailableTransitions(STATES.ERP_SYNCED);
      expect(transitions).toContain(STATES.UNDER_QUALIFICATION);
      expect(transitions).toHaveLength(1);
    });
  });

  describe('getAllStates', () => {
    test('should return all states', () => {
      const allStates = stateMachine.getAllStates();
      expect(allStates).toHaveLength(12);
      expect(allStates).toEqual(Object.values(STATES));
    });
  });
});
