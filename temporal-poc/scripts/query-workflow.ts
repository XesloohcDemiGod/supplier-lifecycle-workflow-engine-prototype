/**
 * Script to query workflow status
 * 
 * Usage:
 *   npm run query-workflow -- --workflow-id supplier-onboarding-<UUID>
 */

import { createClient } from '../src/client';

async function main() {
  const args = process.argv.slice(2);
  
  const workflowId = getArg(args, '--workflow-id');
  
  if (!workflowId) {
    console.error('Error: --workflow-id is required');
    console.log('Usage: npm run query-workflow -- --workflow-id <workflowId>');
    process.exit(1);
  }

  console.log(`Querying workflow: ${workflowId}`);
  console.log('-------------------------------------------\n');

  try {
    // Create Temporal client
    const client = await createClient();

    // Get workflow handle
    const handle = client.workflow.getHandle(workflowId);

    // Describe workflow
    const description = await handle.describe();

    console.log('Workflow Status:');
    console.log('-------------------------------------------');
    console.log(`Status: ${description.status.name}`);
    console.log(`Type: ${description.type}`);
    console.log(`Start Time: ${description.startTime}`);
    console.log(`Execution Time: ${description.executionTime || 'N/A'}`);
    console.log(`Close Time: ${description.closeTime || 'Running'}`);
    console.log('-------------------------------------------\n');

    // Try to get result if completed
    if (description.status.name === 'COMPLETED') {
      try {
        const result = await handle.result();
        console.log('Workflow Result:');
        console.log('-------------------------------------------');
        console.log(JSON.stringify(result, null, 2));
        console.log('-------------------------------------------');
      } catch (error) {
        console.error('Error getting result:', error);
      }
    } else {
      console.log('Workflow is still running. Check the Web UI for details:');
      console.log(`http://localhost:8080/namespaces/default/workflows/${workflowId}`);
    }

  } catch (error) {
    console.error('Error querying workflow:', error);
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
