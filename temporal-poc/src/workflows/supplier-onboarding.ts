/**
 * Supplier Onboarding Workflow
 * 
 * This workflow orchestrates the complete supplier lifecycle from
 * initial request through qualification.
 * 
 * Key features demonstrated:
 * - Durable execution (survives restarts)
 * - Automatic retries on activity failures
 * - Parallel execution (multiple reviews at once)
 * - Long-running waits (days/weeks for human actions)
 * - Conditional logic and error handling
 * - Compensation/rollback logic
 */

import { proxyActivities, sleep, condition } from '@temporalio/workflow';
import type * as activities from '../activities/supplier-activities';
import type * as erpActivities from '../activities/erp-activities';
import type * as notificationActivities from '../activities/notification-activities';
import {
  SupplierOnboardingInput,
  SupplierOnboardingResult,
  SupplierState,
  ReviewResult,
} from '../types';

// Configure activity options with retry policies
const supplierActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '30s',
  },
});

const erp = proxyActivities<typeof erpActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumAttempts: 5,
    maximumInterval: '1m',
  },
});

const notifications = proxyActivities<typeof notificationActivities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

/**
 * Main supplier onboarding workflow
 * 
 * This function defines the workflow logic. The Temporal SDK ensures:
 * - The workflow is durable (survives crashes)
 * - All state is persisted
 * - Execution can be replayed from any point
 * - Long waits don't block resources
 */
export async function supplierOnboardingWorkflow(
  input: SupplierOnboardingInput
): Promise<SupplierOnboardingResult> {
  const { supplierInfo, autoApprove = false, skipQualification = false } = input;
  const startTime = Date.now();
  
  console.log('Starting supplier onboarding workflow', {
    supplierId: supplierInfo.id,
    companyName: supplierInfo.companyName,
  });

  // Step 1: Create supplier request
  await supplierActivities.updateSupplierState(
    supplierInfo.id,
    SupplierState.REQUESTED,
    supplierInfo.requestedBy,
    'Initial supplier request'
  );

  // Step 2: Send registration invitation
  await notifications.notifyStateChange(
    supplierInfo.id,
    supplierInfo.contactEmail,
    SupplierState.REQUESTED,
    SupplierState.PENDING_REGISTRATION
  );
  
  await supplierActivities.sendRegistrationInvite(
    supplierInfo.id,
    supplierInfo.contactEmail
  );
  
  await supplierActivities.updateSupplierState(
    supplierInfo.id,
    SupplierState.PENDING_REGISTRATION,
    'system',
    'Registration invitation sent'
  );

  // Step 3: Wait for supplier registration
  // In production, this would wait for a signal from the registration portal
  // For demo, we simulate it with a short wait
  console.log('Waiting for supplier registration...');
  
  // THIS IS THE MAGIC: Workflow can wait days/weeks without blocking!
  // In production: await condition(() => isRegistered(supplierInfo.id), '7 days');
  await sleep('10 seconds'); // Demo: short wait
  
  // Complete registration (in production, triggered by supplier action)
  await supplierActivities.completeRegistration(supplierInfo.id, {
    contactEmail: supplierInfo.contactEmail,
    taxId: supplierInfo.taxId || 'TAX-' + Date.now(),
    businessType: supplierInfo.businessType || 'Manufacturer',
    address: supplierInfo.address || {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      country: 'USA',
    },
  });
  
  await supplierActivities.updateSupplierState(
    supplierInfo.id,
    SupplierState.REGISTERED,
    supplierInfo.contactEmail,
    'Supplier registration completed'
  );

  // Step 4: Internal reviews (parallel execution)
  await supplierActivities.updateSupplierState(
    supplierInfo.id,
    SupplierState.UNDER_REVIEW,
    'system',
    'Starting internal reviews'
  );
  
  // Notify review teams
  await notifications.notifyTaskAssignment(
    'legal-team@example.com',
    'Legal Review',
    supplierInfo.id
  );
  await notifications.notifyTaskAssignment(
    'finance-team@example.com',
    'Financial Review',
    supplierInfo.id
  );
  await notifications.notifyTaskAssignment(
    'compliance-team@example.com',
    'Compliance Review',
    supplierInfo.id
  );

  // Run reviews in parallel - MUCH faster than sequential!
  console.log('Starting parallel reviews...');
  const [legalReview, financialReview, complianceReview] = await Promise.all([
    supplierActivities.performLegalReview(supplierInfo.id),
    supplierActivities.performFinancialReview(supplierInfo.id),
    supplierActivities.performComplianceReview(supplierInfo.id),
  ]);

  // Check if all reviews passed (or auto-approve for demo)
  const allApproved = autoApprove || (
    legalReview.approved &&
    financialReview.approved &&
    complianceReview.approved
  );

  if (!allApproved) {
    // Rejection path
    const rejectionReason = [
      !legalReview.approved && 'Legal: ' + legalReview.notes,
      !financialReview.approved && 'Financial: ' + financialReview.notes,
      !complianceReview.approved && 'Compliance: ' + complianceReview.notes,
    ]
      .filter(Boolean)
      .join('; ');

    await supplierActivities.notifyRejection(supplierInfo.id, rejectionReason);
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.REJECTED,
      'system',
      rejectionReason
    );

    return {
      supplierId: supplierInfo.id,
      finalState: SupplierState.REJECTED,
      qualified: false,
      completedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }

  // Step 5: Approve for ERP
  await supplierActivities.updateSupplierState(
    supplierInfo.id,
    SupplierState.APPROVED_FOR_ERP,
    'system',
    'All reviews passed'
  );

  // Step 6: ERP Sync (with error handling and rollback)
  console.log('Starting ERP sync...');
  let erpId: string | undefined;
  
  try {
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.ERP_SYNC_IN_PROGRESS,
      'system',
      'Starting ERP synchronization'
    );

    await erp.startERPSync(supplierInfo.id);
    
    // Wait for ERP sync to complete (can take minutes)
    const erpResult = await erp.completeERPSync(supplierInfo.id);
    erpId = erpResult.erpId;
    
    // Verify sync
    const verified = await erp.verifyERPSync(erpId!);
    if (!verified) {
      throw new Error('ERP sync verification failed');
    }

    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.ERP_SYNCED,
      'system',
      `Synced to ERP with ID: ${erpId}`
    );
    
    console.log(`ERP sync completed successfully. ERP ID: ${erpId}`);
  } catch (error) {
    console.error('ERP sync failed:', error);
    
    // Rollback if we got an ERP ID
    if (erpId) {
      console.log('Rolling back ERP sync...');
      await erp.rollbackERPSync(supplierInfo.id, erpId);
    }
    
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.REJECTED,
      'system',
      `ERP sync failed: ${error}`
    );

    return {
      supplierId: supplierInfo.id,
      finalState: SupplierState.REJECTED,
      qualified: false,
      completedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }

  // Step 7: Qualification (optional for demo)
  let qualified = false;
  
  if (!skipQualification) {
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.UNDER_QUALIFICATION,
      'system',
      'Starting qualification process'
    );

    // In production, this might wait for external assessments, audits, etc.
    await sleep('5 seconds'); // Demo: simulate qualification process
    
    // For demo: automatically qualify
    qualified = true;
    
    const finalState = qualified ? SupplierState.QUALIFIED : SupplierState.DISQUALIFIED;
    
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      finalState,
      'system',
      qualified ? 'Qualification successful' : 'Qualification failed'
    );
    
    await notifications.notifyQualificationResult(
      supplierInfo.id,
      supplierInfo.contactEmail,
      qualified,
      qualified ? 'All criteria met' : 'Additional documentation required'
    );
  } else {
    // Skip qualification for demo
    qualified = true;
    await supplierActivities.updateSupplierState(
      supplierInfo.id,
      SupplierState.QUALIFIED,
      'system',
      'Qualification skipped for demo'
    );
  }

  // Success!
  const finalState = qualified ? SupplierState.QUALIFIED : SupplierState.DISQUALIFIED;
  
  console.log('Supplier onboarding workflow completed', {
    supplierId: supplierInfo.id,
    finalState,
    erpId,
    duration: Date.now() - startTime,
  });

  return {
    supplierId: supplierInfo.id,
    finalState,
    erpId,
    qualified,
    completedAt: new Date(),
    duration: Date.now() - startTime,
  };
}
