# Supplier Lifecycle Management - Second Brain

A comprehensive prototype system for managing the supplier lifecycle from initial request through qualification. This system implements a 12-state workflow engine with explicit state machines, auditable transitions, and a complete UI for managing supplier interactions.

## 📚 Documentation

- **[Setup Guide](./SETUP.md)** - Complete installation and configuration guide
- **[API Documentation](./API.md)** - Detailed API endpoint reference
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Overview of production hardening features
- **[PR Review](./PR_REVIEW.md)** - Comprehensive review of PR #3 (Production Hardening)
- **[Product Roadmap](./ROADMAP.md)** - Detailed roadmap for 2026-2027
- **[Review & Roadmap Summary](./REVIEW_AND_ROADMAP_SUMMARY.md)** - Executive summary
- **[Workflow Engine Evaluation](./WORKFLOW_ENGINE_EVALUATION.md)** - Comprehensive evaluation of Temporal and alternatives
- **[Workflow Engine Quick Comparison](./WORKFLOW_ENGINE_QUICK_COMPARISON.md)** - Executive summary for tech roundtable

## Features

### 🎯 Core Components

1. **12-State Supplier Lifecycle State Machine**
   - Explicit state definitions and transitions
   - Auditable state changes
   - Validation of state transitions

2. **Supplier 360 Profile**
   - Comprehensive supplier information
   - Complete audit trail
   - Lifecycle tracking
   - ERP integration tracking
   - Qualification management

3. **Workflow Engine**
   - Automated task generation
   - State-based workflow progression
   - Multi-user support

4. **REST APIs**
   - Complete CRUD operations
   - State transition endpoints
   - Task management
   - Filtering and search

5. **Minimal UI**
   - Buyer request form
   - Supplier registration portal
   - Task Manager dashboard
   - Supplier 360 overview

## 12-State Lifecycle

```
1. REQUESTED              → Initial buyer request
2. PENDING_REGISTRATION   → Awaiting supplier registration
3. REGISTERED             → Supplier has registered
4. UNDER_REVIEW           → Internal review in progress
5. APPROVED_FOR_ERP       → Approved and ready for ERP sync
6. ERP_SYNC_IN_PROGRESS   → Syncing to ERP system
7. ERP_SYNCED             → Successfully synced to ERP
8. UNDER_QUALIFICATION    → Qualification process active
9. QUALIFIED              → Supplier is qualified
10. DISQUALIFIED          → Supplier failed qualification
11. REJECTED              → Rejected during any stage
12. INACTIVE              → Supplier deactivated
```

## Quick Start

### Installation

```bash
npm install
```

### Run the Server

```bash
npm start
```

The application will be available at:
- UI: http://localhost:3000
- API: http://localhost:3000/api

## Usage Guide

### 1. Buyer Request Workflow

**Purpose**: Internal team members create supplier requests

**Steps**:
1. Navigate to "Buyer Request" tab
2. Fill in supplier information:
   - Company Name
   - Contact Email
   - Contact Phone
   - Business Type
   - Categories
   - Requested By (your name)
3. Submit the request
4. System creates supplier in `REQUESTED` state
5. Click "Send Registration Invitation" to move to `PENDING_REGISTRATION`

**API Example**:
```bash
curl -X POST http://localhost:3000/api/suppliers/request \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corp",
    "contactEmail": "contact@acme.com",
    "contactPhone": "+1-555-0100",
    "businessType": "Manufacturer",
    "categories": ["Electronics", "Components"],
    "requestedBy": "john.buyer"
  }'
```

### 2. Supplier Registration Portal

**Purpose**: External suppliers complete their registration

**Steps**:
1. Navigate to "Supplier Registration" tab
2. Enter Supplier ID (received from buyer)
3. Complete registration form:
   - Contact Email
   - Tax ID
   - Business Type
   - Address details
4. Submit registration
5. System moves supplier to `REGISTERED` state
6. Creates task for internal review

**API Example**:
```bash
curl -X POST http://localhost:3000/api/suppliers/{supplier-id}/register \
  -H "Content-Type: application/json" \
  -d '{
    "contactEmail": "contact@acme.com",
    "taxId": "12-3456789",
    "businessType": "Manufacturer",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "country": "USA"
    }
  }'
```

### 3. Task Manager (Internal)

**Purpose**: Internal team manages workflow tasks

**Features**:
- View pending tasks
- View completed tasks
- Complete tasks
- Trigger workflow actions

**Steps**:
1. Navigate to "Task Manager" tab
2. View pending tasks
3. Click "Complete Task" for any task
4. Follow prompted workflow actions:
   - Start Review → moves to `UNDER_REVIEW`
   - Approve → moves to `APPROVED_FOR_ERP`
   - Start ERP Sync → moves through ERP states
   - Start Qualification → moves to `UNDER_QUALIFICATION`

**API Example**:
```bash
# Get all pending tasks
curl http://localhost:3000/api/tasks?status=PENDING

# Complete a task
curl -X POST http://localhost:3000/api/tasks/{task-id}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "user": "jane.reviewer",
    "notes": "Task completed successfully"
  }'
```

### 4. Supplier 360 Overview

**Purpose**: Comprehensive view of all suppliers and their lifecycle

**Features**:
- View all suppliers
- Filter by state
- View complete supplier profile
- See full audit trail
- Take workflow actions

**Steps**:
1. Navigate to "Supplier 360" tab
2. Click "Load All Suppliers"
3. Filter by state (optional)
4. Click on any supplier to view 360 profile
5. View all details:
   - Company information
   - Lifecycle state
   - ERP integration status
   - Qualification results
   - Complete audit trail
6. Take available actions based on current state

**API Examples**:
```bash
# Get all suppliers
curl http://localhost:3000/api/suppliers

# Get suppliers by state
curl http://localhost:3000/api/suppliers?state=UNDER_REVIEW

# Get specific supplier 360 profile
curl http://localhost:3000/api/suppliers/{supplier-id}
```

## Complete Workflow Example

### End-to-End Supplier Onboarding

1. **Buyer Creates Request**
   ```
   POST /api/suppliers/request
   State: REQUESTED
   ```

2. **Send Registration Invite**
   ```
   POST /api/suppliers/{id}/send-invite
   State: PENDING_REGISTRATION
   ```

3. **Supplier Completes Registration**
   ```
   POST /api/suppliers/{id}/register
   State: REGISTERED
   Creates Task: REVIEW_SUPPLIER
   ```

4. **Internal Review**
   ```
   POST /api/suppliers/{id}/review
   State: UNDER_REVIEW
   ```

5. **Approve for ERP**
   ```
   POST /api/suppliers/{id}/approve
   State: APPROVED_FOR_ERP
   Creates Task: ERP_SYNC
   ```

6. **ERP Sync Process**
   ```
   POST /api/suppliers/{id}/erp-sync/start
   State: ERP_SYNC_IN_PROGRESS
   
   POST /api/suppliers/{id}/erp-sync/complete
   State: ERP_SYNCED
   Creates Task: QUALIFY_SUPPLIER
   ```

7. **Qualification Process**
   ```
   POST /api/suppliers/{id}/qualification/start
   State: UNDER_QUALIFICATION
   
   POST /api/suppliers/{id}/qualification/qualify
   State: QUALIFIED
   ```

8. **Optional: Deactivation**
   ```
   POST /api/suppliers/{id}/deactivate
   State: INACTIVE
   ```

## API Reference

### Supplier Management

- `POST /api/suppliers/request` - Create supplier request
- `POST /api/suppliers/:id/send-invite` - Send registration invitation
- `POST /api/suppliers/:id/register` - Complete registration
- `GET /api/suppliers` - List all suppliers (filter by ?state=STATE)
- `GET /api/suppliers/:id` - Get supplier 360 profile

### Review & Approval

- `POST /api/suppliers/:id/review` - Start internal review
- `POST /api/suppliers/:id/approve` - Approve for ERP sync
- `POST /api/suppliers/:id/reject` - Reject supplier

### ERP Integration

- `POST /api/suppliers/:id/erp-sync/start` - Start ERP sync
- `POST /api/suppliers/:id/erp-sync/complete` - Complete ERP sync

### Qualification

- `POST /api/suppliers/:id/qualification/start` - Start qualification
- `POST /api/suppliers/:id/qualification/qualify` - Qualify supplier
- `POST /api/suppliers/:id/qualification/disqualify` - Disqualify supplier

### Lifecycle Management

- `POST /api/suppliers/:id/deactivate` - Deactivate supplier

### Task Management

- `GET /api/tasks` - List all tasks (filter by ?status=PENDING)
- `GET /api/tasks?supplierId={id}` - Get tasks for specific supplier
- `POST /api/tasks/:id/complete` - Complete a task

### Utility

- `GET /api/states` - Get all available states
- `GET /health` - Health check

## Architecture

### State Machine Design

The system uses an explicit state machine with:
- Defined states (`STATES` object)
- Transition rules (`TRANSITIONS` object)
- Validation before state changes
- Automatic rejection path from most states

### Audit Trail

Every state transition is recorded with:
- Timestamp
- Action performed
- User who performed it
- Previous state
- Notes/reason

### Task System

Tasks are automatically created at key workflow points:
- After request: Send registration link
- After registration: Review supplier
- After approval: ERP sync
- After ERP sync: Qualification

## Project Structure

```
├── src/
│   ├── server.js           # Express server and main entry point
│   ├── api.js              # REST API routes
│   ├── state-machine.js    # 12-state lifecycle state machine
│   ├── supplier-profile.js # Supplier 360 Profile model
│   └── workflow-engine.js  # Workflow engine and business logic
├── public/
│   ├── index.html          # Main UI
│   ├── app.js              # Client-side JavaScript
│   └── styles.css          # Styling
├── package.json
└── README.md
```

## Technology Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + HTML5 + CSS3
- **State Management**: In-memory (easily replaceable with database)
- **UUID**: For unique identifiers

## Development

### Adding New States

1. Update `STATES` object in `src/state-machine.js`
2. Update `TRANSITIONS` object with valid transitions
3. Add workflow methods in `src/workflow-engine.js`
4. Add API endpoints in `src/api.js`
5. Update UI in `public/` files

### Extending the API

The API is designed to be extended. Common patterns:
- All state changes return updated supplier profile
- All endpoints validate transitions before applying
- Audit trail is automatically maintained

## Future Enhancements

See our comprehensive [Product Roadmap](./ROADMAP.md) for detailed plans:

### Short-Term (Q1 2026)
- Frontend authentication integration
- Test coverage improvement (60%+)
- CI/CD pipeline setup
- Database optimization

### Medium-Term (Q2-Q3 2026)
- PostgreSQL migration for scalability
- Redis caching layer
- Email and webhook notifications
- Document management system
- Real ERP integration
- Workflow customization

### Long-Term (Q4 2026 - 2027)
- AI-powered supplier risk assessment
- Advanced analytics platform
- Multi-tenancy support
- Modern React/Vue frontend
- Mobile applications
- Contract management
- Supplier self-service portal

For complete details, see [ROADMAP.md](./ROADMAP.md) and [PR_REVIEW.md](./PR_REVIEW.md).

## License

MIT