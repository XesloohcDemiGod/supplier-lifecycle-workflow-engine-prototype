/**
 * Notification and communication activities
 */

import { SupplierState } from '../types';

/**
 * Send email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  console.log(`Activity: Sending email to ${to}`);
  console.log(`Subject: ${subject}`);
  
  // Simulate email sending
  await sleep(500);
  
  // In production: Use email service (SendGrid, AWS SES, etc.)
  // await emailService.send({ to, subject, body });
  
  console.log('Email sent successfully');
}

/**
 * Send state change notification
 */
export async function notifyStateChange(
  supplierId: string,
  email: string,
  oldState: SupplierState,
  newState: SupplierState
): Promise<void> {
  console.log(`Activity: Notifying state change for supplier ${supplierId}`);
  console.log(`State transition: ${oldState} -> ${newState}`);
  
  // Simulate notification
  await sleep(500);
  
  // In production: Send notification via email, webhook, etc.
  const subject = `Supplier Status Update: ${newState}`;
  const body = `Your supplier status has changed from ${oldState} to ${newState}.`;
  
  await sendEmail(email, subject, body);
  
  console.log('State change notification sent');
}

/**
 * Send task assignment notification
 */
export async function notifyTaskAssignment(
  assignee: string,
  taskType: string,
  supplierId: string
): Promise<void> {
  console.log(`Activity: Notifying task assignment to ${assignee}`);
  console.log(`Task: ${taskType} for supplier ${supplierId}`);
  
  // Simulate notification
  await sleep(500);
  
  // In production: Create notification, send email, Slack message, etc.
  // await notificationService.create({
  //   assignee,
  //   type: taskType,
  //   supplierId,
  //   url: `https://portal.example.com/tasks/${supplierId}`
  // });
  
  console.log('Task assignment notification sent');
}

/**
 * Send qualification notification
 */
export async function notifyQualificationResult(
  supplierId: string,
  email: string,
  qualified: boolean,
  notes: string
): Promise<void> {
  console.log(`Activity: Notifying qualification result for supplier ${supplierId}`);
  
  // Simulate notification
  await sleep(500);
  
  const subject = qualified 
    ? 'Congratulations! You are now a qualified supplier' 
    : 'Supplier Qualification Update';
  
  const body = qualified
    ? 'Your supplier qualification has been approved. You can now participate in bidding processes.'
    : `Your supplier qualification requires additional information: ${notes}`;
  
  await sendEmail(email, subject, body);
  
  console.log('Qualification notification sent');
}

/**
 * Send SLA warning
 */
export async function sendSLAWarning(
  supplierId: string,
  assignee: string,
  timeRemaining: string
): Promise<void> {
  console.log(`Activity: Sending SLA warning for supplier ${supplierId}`);
  console.log(`Assignee: ${assignee}, Time remaining: ${timeRemaining}`);
  
  // Simulate notification
  await sleep(300);
  
  // In production: Send urgent notification
  // await notificationService.sendUrgent({
  //   assignee,
  //   message: `SLA warning: Supplier ${supplierId} - ${timeRemaining} remaining`
  // });
  
  console.log('SLA warning sent');
}

/**
 * Helper function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
