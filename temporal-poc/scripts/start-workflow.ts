/**
 * Script to start a supplier onboarding workflow
 * 
 * Usage:
 *   npm run start-workflow -- --supplier-name "Acme Corp" --email "contact@acme.com"
 *   npm run start-workflow -- --auto-approve --skip-qualification
 */

import { createClient } from '../src/client';
import { supplierOnboardingWorkflow } from '../src/workflows/supplier-onboarding';
import { SupplierOnboardingInput } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const supplierName = getArg(args, '--supplier-name') || 'Demo Supplier Corp';
  const email = getArg(args, '--email') || 'contact@demosupplier.com';
  const autoApprove = args.includes('--auto-approve');
  const skipQualification = args.includes('--skip-qualification');

  console.log('Starting supplier onboarding workflow...');
  console.log('-------------------------------------------');
  console.log(`Supplier Name: ${supplierName}`);
  console.log(`Email: ${email}`);
  console.log(`Auto-approve: ${autoApprove}`);
  console.log(`Skip qualification: ${skipQualification}`);
  console.log('-------------------------------------------\n');

  try {
    // Create Temporal client
    const client = await createClient();
    console.log('Connected to Temporal server\n');

    // Create workflow input
    const supplierId = uuidv4();
    const input: SupplierOnboardingInput = {
      supplierInfo: {
        id: supplierId,
        companyName: supplierName,
        contactEmail: email,
        contactPhone: '+1-555-0100',
        businessType: 'Manufacturer',
        categories: ['Electronics', 'Components'],
        requestedBy: 'buyer@example.com',
      },
      autoApprove,
      skipQualification,
    };

    // Start workflow
    const handle = await client.workflow.start(supplierOnboardingWorkflow, {
      taskQueue: 'supplier-lifecycle',
      workflowId: `supplier-onboarding-${supplierId}`,
      args: [input],
    });

    console.log(`✅ Workflow started successfully!`);
    console.log(`Workflow ID: ${handle.workflowId}`);
    console.log(`Run ID: ${handle.firstExecutionRunId}`);
    console.log('');
    console.log('📊 Monitor execution:');
    console.log(`   Web UI: http://localhost:8080/namespaces/default/workflows/${handle.workflowId}`);
    console.log('');
    console.log('⏳ Waiting for workflow to complete...');
    console.log('   (This may take 20-30 seconds for the demo)');
    console.log('');

    // Wait for workflow to complete
    const result = await handle.result();

    console.log('✅ Workflow completed successfully!');
    console.log('-------------------------------------------');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('-------------------------------------------');
    console.log('');
    console.log('🎉 Supplier onboarding finished!');
    console.log(`   Supplier ID: ${result.supplierId}`);
    console.log(`   Final State: ${result.finalState}`);
    console.log(`   ERP ID: ${result.erpId || 'N/A'}`);
    console.log(`   Qualified: ${result.qualified ? 'Yes' : 'No'}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);

  } catch (error) {
    console.error('❌ Error starting workflow:', error);
    process.exit(1);
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0 && index < args.length - 1) {
    return args[index + 1];
  }
  return undefined;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
