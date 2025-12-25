/**
 * Database Schema
 * Creates all tables for the supplier lifecycle system
 */

const SCHEMA = `
-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Buyer', 'Supplier', 'Reviewer', 'Finance', 'Admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login TEXT,
  is_active INTEGER DEFAULT 1
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT,
  tax_id TEXT,
  business_type TEXT,
  categories TEXT,
  current_state TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_date TEXT NOT NULL,
  erp_id TEXT,
  erp_sync_date TEXT,
  qualification_score REAL,
  qualification_date TEXT,
  qualification_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_state ON suppliers(current_state);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(contact_email);
CREATE INDEX IF NOT EXISTS idx_suppliers_requested_by ON suppliers(requested_by);

-- Audit trail table
CREATE TABLE IF NOT EXISTS audit_trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  user TEXT NOT NULL,
  previous_state TEXT,
  notes TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_supplier ON audit_trail(supplier_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_trail(timestamp);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  completed_by TEXT,
  notes TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_supplier ON tasks(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

-- Refresh tokens table for JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
`;

module.exports = SCHEMA;
