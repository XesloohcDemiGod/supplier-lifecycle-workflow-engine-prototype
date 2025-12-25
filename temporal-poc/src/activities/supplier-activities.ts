/**
 * Supplier-related activities
 * 
 * Activities are functions that interact with external systems
 * They can fail and will be automatically retried by Temporal
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SupplierInfo,
  SupplierState,
  RegistrationData,
  ReviewResult,
  AuditEntry,
} from '../types';

/**
 * Create a new supplier request
 * In production, this would call your database/API
 */
export async function createSupplierRequest(
  supplierInfo: SupplierInfo
): Promise<string> {
  console.log('Activity: Creating supplier request', supplierInfo);
  
  // Simulate database call
  await sleep(500);
  
  // In production: Save to database
  // const supplierId = await database.suppliers.create(supplierInfo);
  
  console.log(`Supplier created with ID: ${supplierInfo.id}`);
  return supplierInfo.id;
}

/**
 * Send registration invitation email
 */
export async function sendRegistrationInvite(
  supplierId: string,
  email: string
): Promise<void> {
  console.log(`Activity: Sending registration invite to ${email} for supplier ${supplierId}`);
  
  // Simulate email sending
  await sleep(1000);
  
  // In production: Call email service
  // await emailService.send({
  //   to: email,
  //   template: 'registration-invite',
  //   data: { supplierId, registrationUrl: `https://portal.example.com/register/${supplierId}` }
  // });
  
  console.log('Registration invite sent successfully');
}

/**
 * Complete supplier registration
 * This would be called when supplier submits registration form
 */
export async function completeRegistration(
  supplierId: string,
  registrationData: RegistrationData
): Promise<void> {
  console.log('Activity: Completing registration', { supplierId, registrationData });
  
  // Simulate database update
  await sleep(500);
  
  // In production: Update database
  // await database.suppliers.update(supplierId, {
  //   taxId: registrationData.taxId,
  //   address: registrationData.address,
  //   businessType: registrationData.businessType,
  //   state: SupplierState.REGISTERED
  // });
  
  console.log('Registration completed successfully');
}

/**
 * Perform legal review
 */
export async function performLegalReview(supplierId: string): Promise<ReviewResult> {
  console.log(`Activity: Performing legal review for supplier ${supplierId}`);
  
  // Simulate review process (in reality, this might take hours/days)
  await sleep(2000);
  
  // In production: Check legal documents, compliance, etc.
  const approved = Math.random() > 0.1; // 90% approval rate for demo
  
  const result: ReviewResult = {
    approved,
    reviewer: 'legal-team@example.com',
    notes: approved ? 'All legal checks passed' : 'Missing required documents',
    timestamp: new Date(),
  };
  
  console.log('Legal review completed:', result);
  return result;
}

/**
 * Perform financial review
 */
export async function performFinancialReview(supplierId: string): Promise<ReviewResult> {
  console.log(`Activity: Performing financial review for supplier ${supplierId}`);
  
  // Simulate review process
  await sleep(2000);
  
  // In production: Check credit score, financial statements, etc.
  const approved = Math.random() > 0.1; // 90% approval rate for demo
  
  const result: ReviewResult = {
    approved,
    reviewer: 'finance-team@example.com',
    notes: approved ? 'Financial health is good' : 'Credit concerns identified',
    timestamp: new Date(),
  };
  
  console.log('Financial review completed:', result);
  return result;
}

/**
 * Perform compliance review
 */
export async function performComplianceReview(supplierId: string): Promise<ReviewResult> {
  console.log(`Activity: Performing compliance review for supplier ${supplierId}`);
  
  // Simulate review process
  await sleep(2000);
  
  // In production: Check certifications, regulatory compliance, etc.
  const approved = Math.random() > 0.1; // 90% approval rate for demo
  
  const result: ReviewResult = {
    approved,
    reviewer: 'compliance-team@example.com',
    notes: approved ? 'All compliance requirements met' : 'Missing ISO certifications',
    timestamp: new Date(),
  };
  
  console.log('Compliance review completed:', result);
  return result;
}

/**
 * Notify about rejection
 */
export async function notifyRejection(
  supplierId: string,
  reason: string
): Promise<void> {
  console.log(`Activity: Notifying rejection for supplier ${supplierId}: ${reason}`);
  
  // Simulate email sending
  await sleep(500);
  
  // In production: Send rejection email
  // await emailService.send({
  //   to: supplier.email,
  //   template: 'supplier-rejected',
  //   data: { supplierId, reason }
  // });
  
  console.log('Rejection notification sent');
}

/**
 * Update supplier state
 * In production, this updates your database
 */
export async function updateSupplierState(
  supplierId: string,
  newState: SupplierState,
  user: string,
  notes?: string
): Promise<void> {
  console.log(`Activity: Updating supplier ${supplierId} state to ${newState}`);
  
  // Simulate database update
  await sleep(300);
  
  // In production: Update database
  // await database.suppliers.update(supplierId, { state: newState });
  // await database.auditLog.create({
  //   supplierId,
  //   action: `State changed to ${newState}`,
  //   user,
  //   notes,
  //   timestamp: new Date()
  // });
  
  console.log('Supplier state updated successfully');
}

/**
 * Create audit entry
 */
export async function createAuditEntry(
  supplierId: string,
  entry: AuditEntry
): Promise<void> {
  console.log('Activity: Creating audit entry', { supplierId, entry });
  
  // Simulate database insert
  await sleep(200);
  
  // In production: Save to audit log
  // await database.auditLog.create({
  //   supplierId,
  //   ...entry
  // });
  
  console.log('Audit entry created');
}

/**
 * Helper function to simulate async operations
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
