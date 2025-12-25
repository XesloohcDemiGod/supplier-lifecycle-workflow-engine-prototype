/**
 * Full Lifecycle Example
 * 
 * This example demonstrates the complete supplier lifecycle workflow
 * including all states and transitions.
 */

import { createClient } from '../src/client';
import { supplierOnboardingWorkflow } from '../src/workflows/supplier-onboarding';
import { SupplierOnboardingInput } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

async function runFullLifecycleExample() {
  console.log('='.repeat(60));
  console.log('TEMPORAL POC - FULL SUPPLIER LIFECYCLE EXAMPLE');
  console.log('='.repeat(60));
  console.log('');
  console.log('This example demonstrates:');
  console.log('  ✓ Durable execution (survives crashes)');
  console.log('  ✓ Automatic retries on failures');
  console.log('  ✓ Parallel execution (multiple reviews)');
  console.log('  ✓ Long-running workflows (waits for actions)');
  console.log('  ✓ State transitions and audit trail');
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Connect to Temporal
    console.log('📡 Connecting to Temporal server...');
    const client = await createClient();
    console.log('✅ Connected successfully!\n');

    // Example 1: Successful onboarding
    console.log('Example 1: Successful Supplier Onboarding');
    console.log('-'.repeat(60));
    await runSuccessfulOnboarding(client);
    console.log('');

    // Example 2: With auto-approve (faster demo)
    console.log('Example 2: Auto-Approved Onboarding (Fast Demo)');
    console.log('-'.repeat(60));
    await runAutoApprovedOnboarding(client);
    console.log('');

    // Example 3: Multiple suppliers in parallel
    console.log('Example 3: Multiple Suppliers in Parallel');
    console.log('-'.repeat(60));
    await runParallelOnboarding(client);
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ ALL EXAMPLES COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check the Temporal Web UI: http://localhost:8080');
    console.log('  2. Explore workflow histories and event logs');
    console.log('  3. Try killing the worker mid-workflow and restarting it');
    console.log('  4. Customize the workflows for your use case');
    console.log('');

  } catch (error) {
    console.error('❌ Error running examples:', error);
    process.exit(1);
  }
}

async function runSuccessfulOnboarding(client: any) {
  const supplierId = uuidv4();
  const input: SupplierOnboardingInput = {
    supplierInfo: {
      id: supplierId,
      companyName: 'Acme Manufacturing Corp',
      contactEmail: 'contact@acme-mfg.com',
      contactPhone: '+1-555-0100',
      businessType: 'Manufacturer',
      categories: ['Electronics', 'Components', 'Industrial'],
      requestedBy: 'john.buyer@example.com',
    },
    autoApprove: false, // Let it go through real reviews
    skipQualification: false, // Full lifecycle
  };

  console.log(`Starting workflow for: ${input.supplierInfo.companyName}`);
  const handle = await client.workflow.start(supplierOnboardingWorkflow, {
    taskQueue: 'supplier-lifecycle',
    workflowId: `example-1-${supplierId}`,
    args: [input],
  });

  console.log(`Workflow ID: ${handle.workflowId}`);
  console.log('⏳ Waiting for completion (30-40 seconds)...');

  const result = await handle.result();
  
  console.log('✅ Completed!');
  console.log(`   State: ${result.finalState}`);
  console.log(`   ERP ID: ${result.erpId}`);
  console.log(`   Qualified: ${result.qualified}`);
  console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
}

async function runAutoApprovedOnboarding(client: any) {
  const supplierId = uuidv4();
  const input: SupplierOnboardingInput = {
    supplierInfo: {
      id: supplierId,
      companyName: 'QuickStart Supplies Inc',
      contactEmail: 'info@quickstart.com',
      contactPhone: '+1-555-0200',
      businessType: 'Distributor',
      categories: ['Office Supplies'],
      requestedBy: 'jane.buyer@example.com',
    },
    autoApprove: true, // Skip reviews for faster demo
    skipQualification: true, // Skip qualification
  };

  console.log(`Starting workflow for: ${input.supplierInfo.companyName}`);
  const handle = await client.workflow.start(supplierOnboardingWorkflow, {
    taskQueue: 'supplier-lifecycle',
    workflowId: `example-2-${supplierId}`,
    args: [input],
  });

  console.log(`Workflow ID: ${handle.workflowId}`);
  console.log('⏳ Waiting for completion (15-20 seconds)...');

  const result = await handle.result();
  
  console.log('✅ Completed!');
  console.log(`   State: ${result.finalState}`);
  console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
}

async function runParallelOnboarding(client: any) {
  const suppliers = [
    { name: 'Global Tech Solutions', email: 'contact@globaltech.com' },
    { name: 'Premier Components Ltd', email: 'info@premier.com' },
    { name: 'Advanced Materials Co', email: 'sales@advmat.com' },
  ];

  console.log(`Starting ${suppliers.length} workflows in parallel...`);

  const handles = await Promise.all(
    suppliers.map(async (supplier) => {
      const supplierId = uuidv4();
      const input: SupplierOnboardingInput = {
        supplierInfo: {
          id: supplierId,
          companyName: supplier.name,
          contactEmail: supplier.email,
          contactPhone: '+1-555-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
          businessType: 'Manufacturer',
          categories: ['Industrial'],
          requestedBy: 'procurement@example.com',
        },
        autoApprove: true,
        skipQualification: true,
      };

      return client.workflow.start(supplierOnboardingWorkflow, {
        taskQueue: 'supplier-lifecycle',
        workflowId: `example-3-${supplierId}`,
        args: [input],
      });
    })
  );

  console.log(`✅ Started ${handles.length} workflows`);
  console.log('⏳ Waiting for all to complete...');

  const results = await Promise.all(handles.map((h) => h.result()));

  console.log('✅ All completed!');
  results.forEach((result, i) => {
    console.log(`   ${suppliers[i].name}: ${result.finalState} (${(result.duration / 1000).toFixed(1)}s)`);
  });
}

// Run the examples
runFullLifecycleExample().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
