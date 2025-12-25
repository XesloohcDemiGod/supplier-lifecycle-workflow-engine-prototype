# API Documentation

## Base URL
`http://localhost:3000/api`

## Endpoints

### Supplier Request (Buyer Workflow)

#### Create Supplier Request
**POST** `/suppliers/request`

Creates a new supplier request initiated by a buyer.

**Request Body:**
```json
{
  "companyName": "Acme Corp",
  "contactEmail": "contact@acme.com",
  "contactPhone": "+1-555-0100",
  "businessType": "Manufacturer",
  "categories": ["Electronics", "Components"],
  "requestedBy": "john.buyer"
}
```

**Response:**
```json
{
  "success": true,
  "supplier": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "currentState": "REQUESTED",
    "auditTrail": [...]
  }
}
```

#### Send Registration Invitation
**POST** `/suppliers/:id/send-invite`

Transitions supplier to PENDING_REGISTRATION state.

**Request Body:**
```json
{
  "user": "john.buyer"
}
```

### Supplier Registration (External Portal)

#### Complete Registration
**POST** `/suppliers/:id/register`

Supplier completes their registration details.

**Request Body:**
```json
{
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
}
```

### Internal Review

#### Start Review
**POST** `/suppliers/:id/review`

Begin internal review process.

**Request Body:**
```json
{
  "reviewer": "jane.reviewer"
}
```

#### Approve for ERP
**POST** `/suppliers/:id/approve`

Approve supplier for ERP synchronization.

**Request Body:**
```json
{
  "reviewer": "jane.reviewer",
  "notes": "All documentation verified"
}
```

#### Reject Supplier
**POST** `/suppliers/:id/reject`

Reject supplier at any stage.

**Request Body:**
```json
{
  "user": "reviewer",
  "reason": "Incomplete documentation"
}
```

### ERP Integration

#### Start ERP Sync
**POST** `/suppliers/:id/erp-sync/start`

Initiate ERP synchronization.

**Request Body:**
```json
{
  "user": "system"
}
```

#### Complete ERP Sync
**POST** `/suppliers/:id/erp-sync/complete`

Mark ERP sync as complete with ERP ID.

**Request Body:**
```json
{
  "erpId": "ERP-12345",
  "user": "system"
}
```

### Qualification

#### Start Qualification
**POST** `/suppliers/:id/qualification/start`

Begin supplier qualification process.

**Request Body:**
```json
{
  "user": "qual.manager"
}
```

#### Qualify Supplier
**POST** `/suppliers/:id/qualification/qualify`

Mark supplier as qualified.

**Request Body:**
```json
{
  "score": 85,
  "user": "qual.manager",
  "notes": "Passed all quality checks"
}
```

#### Disqualify Supplier
**POST** `/suppliers/:id/qualification/disqualify`

Mark supplier as disqualified.

**Request Body:**
```json
{
  "score": 45,
  "user": "qual.manager",
  "notes": "Failed safety requirements"
}
```

### Lifecycle Management

#### Deactivate Supplier
**POST** `/suppliers/:id/deactivate`

Deactivate a supplier.

**Request Body:**
```json
{
  "user": "admin",
  "reason": "Business closure"
}
```

### Supplier 360 Profile

#### Get All Suppliers
**GET** `/suppliers`

Get all suppliers with optional state filter.

**Query Parameters:**
- `state` (optional): Filter by state (e.g., `QUALIFIED`, `UNDER_REVIEW`)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "suppliers": [...]
}
```

#### Get Supplier Profile
**GET** `/suppliers/:id`

Get complete 360 profile for a supplier.

**Response:**
```json
{
  "success": true,
  "supplier": {
    "id": "uuid",
    "companyName": "Acme Corp",
    "contactEmail": "contact@acme.com",
    "currentState": "QUALIFIED",
    "erpId": "ERP-12345",
    "qualificationScore": 85,
    "auditTrail": [...]
  }
}
```

### Task Management

#### Get Tasks
**GET** `/tasks`

Get all tasks with optional filters.

**Query Parameters:**
- `supplierId` (optional): Filter by supplier ID
- `status` (optional): Filter by status (`PENDING`, `COMPLETED`)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "tasks": [
    {
      "id": "uuid",
      "supplierId": "uuid",
      "taskType": "REVIEW_SUPPLIER",
      "description": "Review supplier registration",
      "assignedTo": "system",
      "status": "PENDING",
      "createdAt": "2025-12-25T05:41:30.249Z"
    }
  ]
}
```

#### Complete Task
**POST** `/tasks/:id/complete`

Mark a task as completed.

**Request Body:**
```json
{
  "user": "jane.reviewer",
  "notes": "Task completed successfully"
}
```

### Utility

#### Get All States
**GET** `/states`

Get list of all available lifecycle states.

**Response:**
```json
{
  "success": true,
  "states": [
    "REQUESTED",
    "PENDING_REGISTRATION",
    "REGISTERED",
    "UNDER_REVIEW",
    "APPROVED_FOR_ERP",
    "ERP_SYNC_IN_PROGRESS",
    "ERP_SYNCED",
    "UNDER_QUALIFICATION",
    "QUALIFIED",
    "DISQUALIFIED",
    "REJECTED",
    "INACTIVE"
  ]
}
```

#### Health Check
**GET** `/health`

Check system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-25T05:41:30.249Z"
}
```

## State Machine

### Valid State Transitions

```
REQUESTED → PENDING_REGISTRATION, REJECTED
PENDING_REGISTRATION → REGISTERED, REJECTED
REGISTERED → UNDER_REVIEW, REJECTED
UNDER_REVIEW → APPROVED_FOR_ERP, REJECTED
APPROVED_FOR_ERP → ERP_SYNC_IN_PROGRESS, REJECTED
ERP_SYNC_IN_PROGRESS → ERP_SYNCED, REJECTED
ERP_SYNCED → UNDER_QUALIFICATION
UNDER_QUALIFICATION → QUALIFIED, DISQUALIFIED
QUALIFIED → INACTIVE
DISQUALIFIED → INACTIVE
REJECTED → INACTIVE
INACTIVE → (terminal state)
```

### State Validation

All state transitions are validated by the state machine. Invalid transitions will return:
```json
{
  "error": "Invalid transition from CURRENT_STATE to NEW_STATE"
}
```

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "Missing required fields: companyName, contactEmail"
}
```

**404 Not Found:**
```json
{
  "error": "Supplier not found"
}
```

**400 Invalid State Transition:**
```json
{
  "error": "Invalid transition from QUALIFIED to UNDER_REVIEW"
}
```

## Audit Trail

Every state change is automatically recorded in the audit trail with:
- Timestamp
- Action performed
- User who performed it
- Previous state
- Notes/reason

Example audit entry:
```json
{
  "timestamp": "2025-12-25T05:41:30.249Z",
  "action": "State transition: REGISTERED -> UNDER_REVIEW",
  "user": "jane.reviewer",
  "previousState": "UNDER_REVIEW",
  "notes": "Internal review started"
}
```

## Examples

### Complete Workflow Example

```bash
# 1. Create supplier request
curl -X POST http://localhost:3000/api/suppliers/request \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corp",
    "contactEmail": "contact@acme.com",
    "requestedBy": "john.buyer"
  }'

# 2. Send invitation
curl -X POST http://localhost:3000/api/suppliers/{id}/send-invite \
  -H "Content-Type: application/json" \
  -d '{"user": "john.buyer"}'

# 3. Complete registration (supplier side)
curl -X POST http://localhost:3000/api/suppliers/{id}/register \
  -H "Content-Type: application/json" \
  -d '{
    "contactEmail": "contact@acme.com",
    "taxId": "12-3456789",
    "address": {"city": "San Francisco"}
  }'

# 4. Start review
curl -X POST http://localhost:3000/api/suppliers/{id}/review \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "jane.reviewer"}'

# 5. Approve
curl -X POST http://localhost:3000/api/suppliers/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "jane.reviewer", "notes": "Approved"}'

# 6. ERP sync
curl -X POST http://localhost:3000/api/suppliers/{id}/erp-sync/start \
  -H "Content-Type: application/json" \
  -d '{"user": "system"}'

curl -X POST http://localhost:3000/api/suppliers/{id}/erp-sync/complete \
  -H "Content-Type: application/json" \
  -d '{"erpId": "ERP-12345", "user": "system"}'

# 7. Qualification
curl -X POST http://localhost:3000/api/suppliers/{id}/qualification/start \
  -H "Content-Type: application/json" \
  -d '{"user": "qual.manager"}'

curl -X POST http://localhost:3000/api/suppliers/{id}/qualification/qualify \
  -H "Content-Type: application/json" \
  -d '{"score": 85, "user": "qual.manager", "notes": "Passed"}'
```
