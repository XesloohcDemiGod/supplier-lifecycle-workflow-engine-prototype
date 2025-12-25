# Temporal PoC - Quick Reference

This is your quick reference guide for the Temporal Proof of Concept.

## File Structure

```
temporal-poc/
├── README.md              ← Start here! Complete overview
├── TESTING.md             ← Test scenarios and validation
├── QUICK_REFERENCE.md     ← This file
├── docker-compose.yml     ← Temporal server setup
├── package.json           ← Dependencies and scripts
├── tsconfig.json          ← TypeScript configuration
├── .env.example           ← Environment template
├── .gitignore             ← Git ignore rules
│
├── src/
│   ├── types.ts           ← Shared type definitions
│   ├── client.ts          ← Temporal client setup
│   ├── worker.ts          ← Worker (executes workflows)
│   │
│   ├── workflows/
│   │   └── supplier-onboarding.ts  ← Main workflow logic
│   │
│   └── activities/
│       ├── supplier-activities.ts  ← Supplier operations
│       ├── erp-activities.ts       ← ERP integration
│       └── notification-activities.ts ← Notifications
│
├── scripts/
│   ├── start-workflow.ts  ← Start a workflow
│   └── query-workflow.ts  ← Query workflow status
│
└── examples/
    └── full-lifecycle-example.ts  ← Complete examples
```

## Quick Start (5 Minutes)

### 1. Start Temporal Server
```bash
docker-compose up -d
```

Wait 30 seconds for services to start.

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Worker (Terminal 1)
```bash
npm run worker
```

Leave this running.

### 4. Run Example (Terminal 2)
```bash
npm run example
```

### 5. View Results
Open http://localhost:8080 to see workflows in Web UI.

## Common Commands

### Start Temporal Server
```bash
cd temporal-poc
docker-compose up -d
```

### Stop Temporal Server
```bash
docker-compose down
```

### Reset Everything (Delete Data)
```bash
docker-compose down -v
```

### Check Server Status
```bash
docker-compose ps
docker-compose logs -f
```

### Start Worker
```bash
npm run worker
```

### Start a Workflow
```bash
# Basic
npm run start-workflow

# With custom name
npm run start-workflow -- --supplier-name "Acme Corp"

# Fast demo (auto-approve)
npm run start-workflow -- --auto-approve --skip-qualification

# Custom email
npm run start-workflow -- --supplier-name "Test" --email "test@example.com"
```

### Query Workflow Status
```bash
npm run query-workflow -- --workflow-id <workflowId>
```

### Run Examples
```bash
npm run example
```

### Build TypeScript
```bash
npm run build
```

## Key Concepts

### Workflow
- Orchestrates the entire process
- Durable - survives crashes
- Deterministic - can be replayed
- Located in: `src/workflows/`

### Activity
- Individual steps/tasks
- Can fail and retry
- Interact with external systems
- Located in: `src/activities/`

### Worker
- Executes workflows and activities
- Can run multiple workers for scaling
- Code: `src/worker.ts`

### Client
- Starts workflows
- Queries status
- Code: `src/client.ts`

## Architecture

```
┌─────────────┐
│   Client    │ ← Start workflows, query status
└──────┬──────┘
       │
┌──────▼──────────────┐
│  Temporal Server    │ ← Orchestrates everything
│  (Docker Container) │
└──────┬──────────────┘
       │
┌──────▼──────┐
│   Worker    │ ← Executes your code
│ (npm run)   │
└─────────────┘
```

## Workflow States

The PoC implements these states from the original engine:

1. REQUESTED → Initial request
2. PENDING_REGISTRATION → Waiting for registration
3. REGISTERED → Supplier registered
4. UNDER_REVIEW → Internal reviews (parallel)
5. APPROVED_FOR_ERP → Reviews passed
6. ERP_SYNC_IN_PROGRESS → Syncing to ERP
7. ERP_SYNCED → ERP sync complete
8. UNDER_QUALIFICATION → Qualification process
9. QUALIFIED → Fully qualified ✅
10. DISQUALIFIED → Failed qualification ❌
11. REJECTED → Rejected during review ❌
12. INACTIVE → Deactivated

## Key Features Demonstrated

### ✅ Durable Execution
- Kill worker mid-workflow
- Restart worker
- Workflow continues from where it stopped

### ✅ Automatic Retries
- Activities fail sometimes
- Temporal retries with exponential backoff
- Eventually succeeds or exhausts retries

### ✅ Parallel Execution
- Multiple reviews happen simultaneously
- Much faster than sequential
- Uses Promise.all

### ✅ Long-Running Workflows
- Can wait days/weeks for actions
- No polling required
- Efficient resource usage

### ✅ Versioning
- Multiple workflow versions can run simultaneously
- Safe evolution of workflows
- Backward compatibility

### ✅ Observability
- Complete workflow history
- Time-travel debugging
- Performance metrics

## Web UI (http://localhost:8080)

### What You Can See:
- All workflows (running, completed, failed)
- Complete execution history
- Event timeline
- Retry attempts
- Performance metrics
- Stack traces

### Useful Views:
1. **Workflows** → See all workflows
2. **Click workflow** → See details
3. **Event History** → See every event
4. **Stack Trace** → Debug execution
5. **Retry** → See retry attempts

## Configuration

### Environment Variables (.env)
```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TASK_QUEUE=supplier-lifecycle
```

### Retry Policy (in workflow)
```typescript
const activities = proxyActivities({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});
```

### Worker Configuration
```typescript
maxConcurrentActivityTaskExecutions: 10,
maxConcurrentWorkflowTaskExecutions: 10,
```

## Testing Scenarios

See [TESTING.md](./TESTING.md) for detailed test scenarios:

1. Basic workflow execution
2. Durable execution (crash recovery)
3. Automatic retries
4. Parallel execution
5. Long-running workflows
6. Multiple workers (scaling)
7. Workflow history
8. Query status
9. Error handling
10. Performance testing
11. Database persistence
12. Web UI features

## Troubleshooting

### Worker Won't Start
```bash
# Check Temporal is running
docker-compose ps

# Check logs
docker-compose logs temporal

# Restart services
docker-compose restart
```

### Can't Connect to Server
```bash
# Ensure Temporal is on localhost:7233
docker-compose ps

# Check if port is accessible
telnet localhost 7233
```

### Workflow Not Appearing
- Check workflow ID is unique
- Verify worker is running
- Check task queue matches
- Look in Web UI for errors

### Activities Timing Out
- Increase `startToCloseTimeout`
- Check activity logs for errors
- Verify external services are accessible

## Cost Estimate (Self-Hosted)

Based on this PoC setup:

### Development
- Local: **$0/month** (Docker on laptop)

### Production (AWS)
- EC2 t3.medium (Temporal): ~$30/month
- RDS PostgreSQL (db.t3.small): ~$25/month
- EC2 t3.small x2 (Workers): ~$30/month
- **Total**: ~$85-120/month

### vs Temporal Cloud
- Self-hosted: $85-120/month
- Temporal Cloud: $500-2000/month
- **Savings**: ~$400-1900/month

## Next Steps

### For Development
1. Customize workflows for your use case
2. Add more activities (database, APIs, etc.)
3. Integrate with your existing systems
4. Add more test scenarios

### For Production
1. Set up proper database (not SQLite in container)
2. Configure monitoring (metrics, alerts)
3. Set up multiple workers for HA
4. Implement proper security (TLS, auth)
5. Configure backups
6. Load test with realistic data

## Resources

### Documentation
- [Temporal Docs](https://docs.temporal.io)
- [TypeScript SDK](https://docs.temporal.io/typescript)
- [Self-Hosting Guide](https://docs.temporal.io/self-hosted)

### Community
- [Temporal Slack](https://t.mp/slack)
- [Community Forum](https://community.temporal.io)
- [GitHub](https://github.com/temporalio/temporal)

### Training
- [Temporal University](https://learn.temporal.io) - Free courses

## Getting Help

1. Check [TESTING.md](./TESTING.md) for common issues
2. Look at example code in `examples/`
3. Review activity logs in worker output
4. Check Web UI for workflow errors
5. Consult Temporal documentation
6. Ask in Temporal community Slack

## Summary

This PoC demonstrates:
- ✅ Temporal works with self-hosted setup
- ✅ Supplier lifecycle workflow is fully functional
- ✅ Durable execution prevents data loss
- ✅ Automatic retries handle failures
- ✅ Parallel execution improves performance
- ✅ Cost-effective ($85-120/month vs $500-2000)

**Ready to migrate!** 🚀
