/**
 * Audit Trail Model
 * Handles audit log persistence
 */

const db = require('../connection');
const logger = require('../../utils/logger');

class AuditTrailModel {
  /**
   * Add audit entry
   */
  static async create(auditData) {
    const { supplierId, action, user, previousState = null, notes = '' } = auditData;
    const timestamp = new Date().toISOString();
    
    await db.run(
      `INSERT INTO audit_trail (supplier_id, timestamp, action, user, previous_state, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [supplierId, timestamp, action, user, previousState, notes]
    );
    
    logger.audit(action, user, { supplierId, previousState, notes });
  }

  /**
   * Get audit trail for supplier
   */
  static async findBySupplierId(supplierId) {
    const entries = await db.all(
      'SELECT * FROM audit_trail WHERE supplier_id = ? ORDER BY timestamp DESC',
      [supplierId]
    );
    
    return entries.map(entry => ({
      id: entry.id,
      supplierId: entry.supplier_id,
      timestamp: entry.timestamp,
      action: entry.action,
      user: entry.user,
      previousState: entry.previous_state,
      notes: entry.notes
    }));
  }

  /**
   * Get all audit entries (admin only)
   */
  static async findAll(limit = 100) {
    const entries = await db.all(
      'SELECT * FROM audit_trail ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    
    return entries.map(entry => ({
      id: entry.id,
      supplierId: entry.supplier_id,
      timestamp: entry.timestamp,
      action: entry.action,
      user: entry.user,
      previousState: entry.previous_state,
      notes: entry.notes
    }));
  }

  /**
   * Get audit entries by user
   */
  static async findByUser(user, limit = 100) {
    const entries = await db.all(
      'SELECT * FROM audit_trail WHERE user = ? ORDER BY timestamp DESC LIMIT ?',
      [user, limit]
    );
    
    return entries.map(entry => ({
      id: entry.id,
      supplierId: entry.supplier_id,
      timestamp: entry.timestamp,
      action: entry.action,
      user: entry.user,
      previousState: entry.previous_state,
      notes: entry.notes
    }));
  }

  /**
   * Delete audit entries for supplier (cascade)
   */
  static async deleteBySupplierId(supplierId) {
    await db.run('DELETE FROM audit_trail WHERE supplier_id = ?', [supplierId]);
    logger.info(`Audit trail deleted for supplier: ${supplierId}`);
  }
}

module.exports = AuditTrailModel;
