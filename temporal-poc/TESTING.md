# Testing Guide for Temporal PoC

This guide explains how to test key Temporal features and validate that the PoC works correctly.

## Prerequisites

1. Start Temporal server:
```bash
docker-compose up -d
```

2. Install dependencies:
```bash
npm install
```

3. Start the worker (in one terminal):
```bash
npm run worker
```

## Test 1: Basic Workflow Execution

**Goal**: Verify workflow completes successfully

```bash
npm run start-workflow -- --supplier-name "Test Corp" --auto-approve --skip-qualification
```

**Expected Result**:
- Workflow completes in ~15-20 seconds
- Final state: QUALIFIED
- ERP ID generated
- Success message displayed

**What to Check**:
- Worker logs show activity execution
- Web UI shows completed workflow
- All activities executed in correct order

## Test 2: Durable Execution (Crash Recovery)

**Goal**: Verify workflow survives worker crashes

**Steps**:
1. Start a workflow (without auto-approve for longer execution):
```bash
npm run start-workflow -- --supplier-name "Durable Test"
```

2. While workflow is running (during reviews), **kill the worker** (Ctrl+C)

3. Wait 5-10 seconds

4. **Restart the worker**:
```bash
npm run worker
```

**Expected Result**:
- Workflow resumes from where it left off
- No activities are re-executed unnecessarily
- Workflow completes successfully

**What This Proves**:
- State is persisted in PostgreSQL
- Workflow execution is durable
- Can survive crashes and continue

## Test 3: Automatic Retries

**Goal**: Verify activities retry on failure

**How to Test**:
Modify an activity to fail occasionally:

```typescript
// In src/activities/erp-activities.ts
export async function completeERPSync(supplierId: string): Promise<ERPSyncResult> {
  // Force failure on first attempt
  if (Math.random() > 0.5) {
    throw new Error('Simulated ERP connection error');
  }
  // ... rest of code
}
```

**Expected Result**:
- Activity fails first time
- Temporal automatically retries (1s, 2s, 4s backoff)
- Eventually succeeds
- Workflow continues normally

**Check**:
- Worker logs show retry attempts
- Web UI shows retry history
- Total execution time is longer

## Test 4: Parallel Execution

**Goal**: Verify parallel reviews are faster

**Run the example**:
```bash
npm run example
```

**Expected Result**:
- Example 3 runs 3 workflows in parallel
- All complete around the same time
- Much faster than sequential

**What to Check**:
- Web UI shows all 3 workflows running simultaneously
- Worker handles concurrent execution
- No blocking or serialization

## Test 5: Long-Running Workflows

**Goal**: Verify workflows can wait days (simulated)

**Modify workflow** (for testing only):
```typescript
// In src/workflows/supplier-onboarding.ts
// Change this line:
await sleep('10 seconds'); // Current demo wait
// To:
await sleep('5 minutes'); // Longer wait for testing
```

**Steps**:
1. Start workflow
2. Kill worker immediately
3. Wait 1 minute
4. Restart worker

**Expected Result**:
- Workflow resumes and continues waiting
- Completes after full 5 minutes
- No issues with long wait time

**What This Proves**:
- Workflows can wait indefinitely
- No polling required
- Resources not blocked during wait

## Test 6: Multiple Workers (Scalability)

**Goal**: Verify horizontal scaling

**Steps**:
1. Start first worker:
```bash
npm run worker
```

2. In another terminal, start second worker:
```bash
npm run worker
```

3. Start multiple workflows:
```bash
npm run example
```

**Expected Result**:
- Both workers pick up tasks
- Load is distributed
- All workflows complete successfully

**What to Check**:
- Worker logs show both processing tasks
- Web UI shows different workers handling tasks
- No conflicts or race conditions

## Test 7: Workflow History and Time Travel

**Goal**: Explore workflow execution history

**Steps**:
1. Run any workflow
2. Open Web UI: http://localhost:8080
3. Find your workflow
4. Click on it to see details

**What to Explore**:
- **Event History**: See every single event (activity started, completed, etc.)
- **Timeline**: Visual representation of execution
- **Retry History**: See any retries that occurred
- **Stack Trace**: Understand workflow execution path
- **Time Travel**: Replay workflow from any point

**Key Features**:
- Complete audit trail
- Debugging capabilities
- Performance analysis

## Test 8: Query Workflow Status

**Goal**: Query running/completed workflows

**Steps**:
1. Start a workflow and note the workflow ID
2. Query it:
```bash
npm run query-workflow -- --workflow-id supplier-onboarding-<UUID>
```

**Expected Result**:
- Shows current status
- If completed, shows result
- Provides execution time info

## Test 9: Error Handling and Rollback

**Goal**: Verify compensation logic works

**Modify code** to force ERP failure:
```typescript
// In src/activities/erp-activities.ts
export async function completeERPSync(supplierId: string): Promise<ERPSyncResult> {
  throw new Error('Simulated ERP failure');
}
```

**Expected Result**:
- ERP sync fails
- Rollback is triggered
- Supplier state changes to REJECTED
- No orphaned records

**What to Check**:
- Rollback activity is called
- Workflow handles error gracefully
- Proper cleanup occurs

## Test 10: Performance Testing

**Goal**: Measure throughput

**Create a load test script**:
```typescript
// test-load.ts
async function runLoadTest() {
  const client = await createClient();
  const count = 100;
  
  console.log(`Starting ${count} workflows...`);
  const start = Date.now();
  
  const promises = [];
  for (let i = 0; i < count; i++) {
    const handle = await client.workflow.start(...);
    promises.push(handle.result());
  }
  
  await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Completed ${count} workflows in ${duration}ms`);
  console.log(`Throughput: ${(count / (duration / 1000)).toFixed(2)} workflows/second`);
}
```

**Expected Result**:
- All workflows complete
- Reasonable throughput (depends on hardware)
- No errors or crashes

## Test 11: Database Persistence

**Goal**: Verify PostgreSQL stores state

**Steps**:
1. Run a workflow
2. Connect to PostgreSQL:
```bash
docker exec -it temporal-postgresql psql -U temporal -d temporal
```

3. Query workflow executions:
```sql
SELECT * FROM executions LIMIT 10;
SELECT * FROM workflow_task_events LIMIT 10;
```

**What to Check**:
- Workflow data is stored
- Event history is persisted
- Can query execution details

## Test 12: Web UI Features

**Goal**: Explore monitoring capabilities

**Open**: http://localhost:8080

**Features to Test**:
1. **Workflow List**: See all workflows
2. **Search**: Find workflows by ID, status, type
3. **Filter**: Filter by state (running, completed, failed)
4. **Details**: Click workflow for full details
5. **Event History**: See complete execution trace
6. **Stack Trace**: Understand code path
7. **Retry Info**: See any retries

## Common Issues and Solutions

### Worker Can't Connect
```
Error: Failed to connect to Temporal
```
**Solution**: Make sure Temporal server is running:
```bash
docker-compose ps
docker-compose logs temporal
```

### Activities Timing Out
```
Activity exceeded startToCloseTimeout
```
**Solution**: Increase timeout in workflow:
```typescript
const activities = proxyActivities({
  startToCloseTimeout: '10 minutes', // Increase this
});
```

### Database Connection Error
```
Connection refused on localhost:5432
```
**Solution**: Check PostgreSQL is running:
```bash
docker-compose logs postgresql
```

### Workflow Already Started
```
Workflow execution already started
```
**Solution**: Use unique workflow IDs or terminate existing one:
```bash
# Via Web UI or tctl
tctl workflow terminate -w <workflowId>
```

## Next Steps

After completing these tests:
1. Customize workflows for your use case
2. Add more activities for your business logic
3. Integrate with your existing database
4. Set up production deployment
5. Configure monitoring and alerting

## Resources

- [Temporal Documentation](https://docs.temporal.io)
- [Testing Guide](https://docs.temporal.io/docs/typescript/testing)
- [Production Deployment](https://docs.temporal.io/docs/production-deployment)
