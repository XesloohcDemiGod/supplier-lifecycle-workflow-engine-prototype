# Temporal Proof of Concept - Self-Hosted Setup

This PoC demonstrates migrating the supplier lifecycle workflow engine to Temporal with a self-hosted deployment.

## Overview

This Proof of Concept includes:
- **Self-hosted Temporal server** setup with Docker Compose
- **Supplier onboarding workflow** implementation in TypeScript
- **Activities** for each workflow step
- **Worker** to execute workflows and activities
- **Client** to start workflows and query status
- **PostgreSQL** for Temporal persistence
- **Complete examples** for the full supplier lifecycle

## Architecture

```
┌─────────────────────────────────────────────┐
│         Client Application                  │
│  (Start workflows, query status)            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         Temporal Server (Self-Hosted)       │
│  ┌────────────┐  ┌──────────────┐          │
│  │  Frontend  │  │   History    │          │
│  │  Service   │  │   Service    │          │
│  └────────────┘  └──────────────┘          │
│  ┌────────────┐  ┌──────────────┐          │
│  │  Matching  │  │   Worker     │          │
│  │  Service   │  │   Service    │          │
│  └────────────┘  └──────────────┘          │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         PostgreSQL Database                 │
│  (Workflow state, history, visibility)      │
└─────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│         Workers (Your Code)                 │
│  - Workflow Definitions                     │
│  - Activity Implementations                 │
│  - Business Logic                           │
└─────────────────────────────────────────────┘
```

## Directory Structure

```
temporal-poc/
├── README.md                      # This file
├── docker-compose.yml             # Temporal server setup
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── .env.example                   # Environment variables template
├── src/
│   ├── workflows/                 # Workflow definitions
│   │   └── supplier-onboarding.ts # Main supplier workflow
│   ├── activities/                # Activity implementations
│   │   ├── supplier-activities.ts # Supplier management activities
│   │   ├── erp-activities.ts      # ERP integration activities
│   │   └── notification-activities.ts # Email/notification activities
│   ├── worker.ts                  # Workflow worker
│   ├── client.ts                  # Client to start workflows
│   └── types.ts                   # Shared types
├── scripts/
│   ├── start-workflow.ts          # Script to start a workflow
│   └── query-workflow.ts          # Script to query workflow status
└── examples/
    └── full-lifecycle-example.ts  # Complete example
```

## Quick Start

### 1. Prerequisites

- Docker & Docker Compose
- Node.js 18+ 
- npm or yarn

### 2. Start Temporal Server

```bash
cd temporal-poc
docker-compose up -d
```

This starts:
- Temporal server (all services)
- PostgreSQL database
- Temporal Web UI at http://localhost:8080

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Worker

In one terminal:
```bash
npm run worker
```

### 5. Start a Workflow

In another terminal:
```bash
npm run start-workflow -- --supplier-name "Acme Corp"
```

### 6. Monitor in Web UI

Open http://localhost:8080 to see workflow execution in real-time.

## Key Features Demonstrated

### 1. Durable Execution
- Workflow survives process restarts
- State is persisted in PostgreSQL
- Can resume from any point

### 2. Automatic Retries
- Activities retry on failure with exponential backoff
- Configurable retry policies
- Circuit breaker patterns

### 3. Long-Running Workflows
- Can wait days/weeks for human actions
- Efficient state storage
- No polling required

### 4. Parallel Execution
- Multiple reviews happen concurrently
- Promise.all support
- Efficient resource usage

### 5. Versioning
- Safe workflow evolution
- Multiple versions running simultaneously
- Backward compatibility

### 6. Observability
- Complete workflow history
- Time-travel debugging
- Performance metrics

## Migration from Custom Engine

### Before (Custom Engine)
```javascript
// Lost if process crashes!
async handleRegistration(supplierId) {
  const supplier = await getSupplier(supplierId);
  supplier.state = 'REGISTERED';
  await saveSupplier(supplier);
}
```

### After (Temporal)
```typescript
// Durable - survives crashes!
export async function supplierOnboardingWorkflow(
  supplierId: string
): Promise<string> {
  // Automatically retries on failure
  await activities.registerSupplier(supplierId);
  
  // Can wait days - no problem!
  await condition(() => isRegistered(supplierId), '7 days');
  
  // Continues after restart
  await activities.syncToERP(supplierId);
  
  return 'Success';
}
```

## Cost Analysis (Self-Hosted)

### Infrastructure Requirements
- **Compute**: 2 vCPU, 4GB RAM (Temporal server)
- **Database**: PostgreSQL with 20GB storage
- **Workers**: 2 vCPU, 2GB RAM per worker (scale as needed)

### Monthly Costs (AWS Example)
- **EC2 t3.medium** (Temporal): ~$30/month
- **RDS PostgreSQL** (db.t3.small): ~$25/month
- **EC2 t3.small** (Workers x2): ~$30/month
- **Total**: ~$85-120/month

### Cost Comparison
- **Self-hosted**: $85-120/month
- **Temporal Cloud**: $500-2000/month
- **Savings**: ~$400-1900/month

### Trade-offs
- **Self-hosted**: Lower cost, more operational overhead
- **Temporal Cloud**: Higher cost, zero operational overhead, better support

## Next Steps

1. **Run the PoC**: Follow Quick Start guide
2. **Test failure scenarios**: Kill worker mid-workflow, see it resume
3. **Explore Web UI**: Understand workflow execution
4. **Customize**: Adapt to your specific requirements
5. **Load test**: Validate performance with your expected load

## Resources

- [Temporal Documentation](https://docs.temporal.io)
- [TypeScript SDK Guide](https://docs.temporal.io/typescript)
- [Self-Hosting Guide](https://docs.temporal.io/self-hosted)
- [Production Deployment](https://docs.temporal.io/production-deployment)

## Support

For questions about this PoC:
1. Check the code comments in src/workflows and src/activities
2. Review the examples/ directory
3. Consult Temporal documentation
4. Ask in Temporal community Slack

## License

MIT
