/**
 * Temporal Worker
 * 
 * The worker connects to Temporal server and executes workflows and activities.
 * You can run multiple workers for horizontal scaling.
 */

import { Worker } from '@temporalio/worker';
import * as activities from './activities/supplier-activities';
import * as erpActivities from './activities/erp-activities';
import * as notificationActivities from './activities/notification-activities';
import * as path from 'path';

async function run() {
  try {
    console.log('Starting Temporal worker...');
    console.log('Connecting to Temporal server at localhost:7233');
    
    // Create worker
    const worker = await Worker.create({
      workflowsPath: require.resolve('./workflows/supplier-onboarding'),
      activities: {
        ...activities,
        ...erpActivities,
        ...notificationActivities,
      },
      taskQueue: 'supplier-lifecycle',
      // Worker configuration
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    console.log('Worker created successfully');
    console.log('Task Queue: supplier-lifecycle');
    console.log('Workflows: supplier-onboarding');
    console.log('Activities: supplier, ERP, notification');
    console.log('');
    console.log('Worker is running and waiting for workflows...');
    console.log('Press Ctrl+C to stop');
    console.log('');
    
    // Run the worker
    await worker.run();
  } catch (error) {
    console.error('Worker error:', error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
