/**
 * Supplier Model
 * Handles supplier data persistence
 */

const db = require('../connection');
const { v4: uuidv4 } = require('uuid');
const { STATES } = require('../../state-machine');
const logger = require('../../utils/logger');
const { camelToSnake } = require('../../utils/helpers');
const { encrypt, decrypt } = require('../../utils/encryption');
const { logSecurityEvent, SEVERITY, EVENT_TYPES } = require('../../utils/security-logger');

class SupplierModel {
  /**
   * Create a new supplier
   */
  static async create(supplierData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const {
      companyName,
      contactEmail,
      contactPhone = null,
      businessType = null,
      categories = [],
      requestedBy,
      currentState = STATES.REQUESTED
    } = supplierData;
    
    // Check for duplicate company name + email (prevent duplicate registrations)
    const existing = await db.get(
      'SELECT id FROM suppliers WHERE company_name = ? AND contact_email = ?',
      [companyName, contactEmail]
    );
    
    if (existing) {
      throw new Error('A supplier with this company name and email already exists');
    }
    
    await db.run(
      `INSERT INTO suppliers (
        id, company_name, contact_email, contact_phone, business_type,
        categories, current_state, requested_by, requested_date,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyName,
        contactEmail,
        contactPhone,
        businessType,
        JSON.stringify(categories),
        currentState,
        requestedBy,
        now,
        now,
        now,
        1
      ]
    );
    
    logger.info(`Supplier created: ${id} - ${companyName}`);
    return await this.findById(id);
  }

  /**
   * Find supplier by ID
   */
  static async findById(id) {
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    return supplier ? this.deserialize(supplier) : null;
  }

  /**
   * Find supplier by company name and email (for duplicate check)
   */
  static async findByCompanyAndEmail(companyName, email) {
    const supplier = await db.get(
      'SELECT * FROM suppliers WHERE company_name = ? AND contact_email = ?',
      [companyName, email]
    );
    return supplier ? this.deserialize(supplier) : null;
  }

  /**
   * Find all suppliers
   */
  static async findAll() {
    const suppliers = await db.all('SELECT * FROM suppliers ORDER BY created_at DESC');
    return suppliers.map(s => this.deserialize(s));
  }

  /**
   * Find suppliers by state
   */
  static async findByState(state) {
    const suppliers = await db.all(
      'SELECT * FROM suppliers WHERE current_state = ? ORDER BY created_at DESC',
      [state]
    );
    return suppliers.map(s => this.deserialize(s));
  }

  /**
   * Update supplier with optimistic locking
   */
  static async updateWithLocking(id, updates, currentVersion) {
    const fields = [];
    const values = [];
    
    const allowedFields = [
      'company_name', 'contact_email', 'contact_phone', 'address_street',
      'address_city', 'address_state', 'address_zip', 'address_country',
      'tax_id', 'tax_id_encrypted', 'business_type', 'categories', 'current_state',
      'erp_id', 'erp_sync_date', 'qualification_score', 'qualification_date',
      'qualification_notes'
    ];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = camelToSnake(key);
      if (allowedFields.includes(dbKey)) {
        fields.push(`${dbKey} = ?`);
        if (key === 'categories' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else if (key === 'taxId' && value) {
          // Encrypt sensitive tax ID
          fields.push('tax_id_encrypted = ?');
          values.push(encrypt(value));
        } else if (key === 'address' && typeof value === 'object') {
          // Handle address object separately
          continue;
        } else {
          values.push(value);
        }
      }
    }
    
    // Handle address object
    if (updates.address && typeof updates.address === 'object') {
      const addressFields = ['street', 'city', 'state', 'zip', 'country'];
      for (const field of addressFields) {
        if (updates.address[field] !== undefined) {
          fields.push(`address_${field} = ?`);
          values.push(updates.address[field]);
        }
      }
    }
    
    if (fields.length === 0) {
      return await this.findById(id);
    }
    
    const newVersion = currentVersion + 1;
    fields.push('version = ?');
    values.push(newVersion);
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    
    values.push(id);
    values.push(currentVersion);
    
    const result = await db.run(
      `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ? AND version = ?`,
      values
    );
    
    if (result.changes === 0) {
      await logSecurityEvent(
        EVENT_TYPES.CONCURRENT_MODIFICATION,
        SEVERITY.MEDIUM,
        { supplierId: id, currentVersion, attemptedVersion: newVersion }
      );
      throw new Error('Concurrent modification detected. Please refresh and try again.');
    }
    
    logger.info(`Supplier updated with optimistic locking: ${id} (v${currentVersion} -> v${newVersion})`);
    return await this.findById(id);
  }

  /**
   * Update supplier (legacy method without locking)
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    
    const allowedFields = [
      'company_name', 'contact_email', 'contact_phone', 'address_street',
      'address_city', 'address_state', 'address_zip', 'address_country',
      'tax_id', 'tax_id_encrypted', 'business_type', 'categories', 'current_state',
      'erp_id', 'erp_sync_date', 'qualification_score', 'qualification_date',
      'qualification_notes'
    ];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = camelToSnake(key);
      if (allowedFields.includes(dbKey)) {
        fields.push(`${dbKey} = ?`);
        if (key === 'categories' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else if (key === 'taxId' && value) {
          // Encrypt sensitive tax ID
          fields.push('tax_id_encrypted = ?');
          values.push(encrypt(value));
        } else if (key === 'address' && typeof value === 'object') {
          // Handle address object separately
          continue;
        } else {
          values.push(value);
        }
      }
    }
    
    // Handle address object
    if (updates.address && typeof updates.address === 'object') {
      const addressFields = ['street', 'city', 'state', 'zip', 'country'];
      for (const field of addressFields) {
        if (updates.address[field] !== undefined) {
          fields.push(`address_${field} = ?`);
          values.push(updates.address[field]);
        }
      }
    }
    
    if (fields.length === 0) {
      return await this.findById(id);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    await db.run(
      `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    logger.info(`Supplier updated: ${id}`);
    return await this.findById(id);
  }

  /**
   * Update supplier state
   */
  static async updateState(id, newState) {
    await db.run(
      'UPDATE suppliers SET current_state = ?, updated_at = ? WHERE id = ?',
      [newState, new Date().toISOString(), id]
    );
    
    logger.info(`Supplier state updated: ${id} -> ${newState}`);
  }

  /**
   * Delete supplier
   */
  static async delete(id) {
    await db.run('DELETE FROM suppliers WHERE id = ?', [id]);
    logger.info(`Supplier deleted: ${id}`);
  }

  /**
   * Convert database row to supplier object
   */
  static deserialize(row) {
    if (!row) return null;
    
    // Decrypt tax ID if encrypted
    let taxId = row.tax_id;
    if (!taxId && row.tax_id_encrypted) {
      try {
        taxId = decrypt(row.tax_id_encrypted);
      } catch (error) {
        logger.error('Failed to decrypt tax ID:', error);
      }
    }
    
    return {
      id: row.id,
      companyName: row.company_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      address: {
        street: row.address_street,
        city: row.address_city,
        state: row.address_state,
        zip: row.address_zip,
        country: row.address_country
      },
      taxId,
      businessType: row.business_type,
      categories: row.categories ? JSON.parse(row.categories) : [],
      currentState: row.current_state,
      requestedBy: row.requested_by,
      requestedDate: row.requested_date,
      erpId: row.erp_id,
      erpSyncDate: row.erp_sync_date,
      qualificationScore: row.qualification_score,
      qualificationDate: row.qualification_date,
      qualificationNotes: row.qualification_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version || 1
    };
  }
}

module.exports = SupplierModel;

