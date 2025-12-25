/**
 * Shared types for Temporal workflows and activities
 */

// Supplier States (from existing state machine)
export enum SupplierState {
  REQUESTED = 'REQUESTED',
  PENDING_REGISTRATION = 'PENDING_REGISTRATION',
  REGISTERED = 'REGISTERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED_FOR_ERP = 'APPROVED_FOR_ERP',
  ERP_SYNC_IN_PROGRESS = 'ERP_SYNC_IN_PROGRESS',
  ERP_SYNCED = 'ERP_SYNCED',
  UNDER_QUALIFICATION = 'UNDER_QUALIFICATION',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
}

// Supplier information
export interface SupplierInfo {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  businessType?: string;
  categories?: string[];
  address?: Address;
  taxId?: string;
  requestedBy: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// Registration data
export interface RegistrationData {
  contactEmail: string;
  taxId: string;
  businessType: string;
  address: Address;
}

// Review result
export interface ReviewResult {
  approved: boolean;
  reviewer: string;
  notes: string;
  timestamp: Date;
}

// ERP sync result
export interface ERPSyncResult {
  success: boolean;
  erpId?: string;
  error?: string;
  timestamp: Date;
}

// Qualification result
export interface QualificationResult {
  qualified: boolean;
  score: number;
  criteria: QualificationCriteria;
  assessor: string;
  notes: string;
  timestamp: Date;
}

export interface QualificationCriteria {
  financialStability: boolean;
  qualityCertifications: boolean;
  complianceCheck: boolean;
  references: boolean;
}

// Workflow input
export interface SupplierOnboardingInput {
  supplierInfo: SupplierInfo;
  autoApprove?: boolean; // For testing
  skipQualification?: boolean; // For testing
}

// Workflow result
export interface SupplierOnboardingResult {
  supplierId: string;
  finalState: SupplierState;
  erpId?: string;
  qualified: boolean;
  completedAt: Date;
  duration: number; // milliseconds
}

// Audit entry
export interface AuditEntry {
  action: string;
  user: string;
  timestamp: Date;
  previousState?: SupplierState;
  newState?: SupplierState;
  notes?: string;
}
