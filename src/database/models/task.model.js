/**
 * Task Model
 * Handles task data persistence
 */

const db = require('../connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { camelToSnake } = require('../../utils/helpers');

class TaskModel {
  /**
   * Create a new task
   */
  static async create(taskData) {
    const {
      supplierId,
      taskType,
      description,
      assignedTo,
      status = 'PENDING'
    } = taskData;
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO tasks (id, supplier_id, task_type, description, assigned_to, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, supplierId, taskType, description, assignedTo, status, now, now]
    );
    
    logger.info(`Task created: ${id} - ${taskType} for supplier ${supplierId}`);
    return await this.findById(id);
  }

  /**
   * Find task by ID
   */
  static async findById(id) {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return task ? this.deserialize(task) : null;
  }

  /**
   * Find all tasks
   */
  static async findAll() {
    const tasks = await db.all('SELECT * FROM tasks ORDER BY created_at DESC');
    return tasks.map(t => this.deserialize(t));
  }

  /**
   * Find tasks by supplier ID
   */
  static async findBySupplierId(supplierId) {
    const tasks = await db.all(
      'SELECT * FROM tasks WHERE supplier_id = ? ORDER BY created_at DESC',
      [supplierId]
    );
    return tasks.map(t => this.deserialize(t));
  }

  /**
   * Find tasks by status
   */
  static async findByStatus(status) {
    const tasks = await db.all(
      'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return tasks.map(t => this.deserialize(t));
  }

  /**
   * Find tasks by assigned user
   */
  static async findByAssignedTo(assignedTo) {
    const tasks = await db.all(
      'SELECT * FROM tasks WHERE assigned_to = ? AND status = ? ORDER BY created_at DESC',
      [assignedTo, 'PENDING']
    );
    return tasks.map(t => this.deserialize(t));
  }

  /**
   * Update task
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    
    const allowedFields = ['status', 'completed_at', 'completed_by', 'notes', 'assigned_to'];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = camelToSnake(key);
      if (allowedFields.includes(dbKey)) {
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return await this.findById(id);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    await db.run(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    logger.info(`Task updated: ${id}`);
    return await this.findById(id);
  }

  /**
   * Complete task
   */
  static async complete(id, completedBy, notes = '') {
    const now = new Date().toISOString();
    
    await db.run(
      'UPDATE tasks SET status = ?, completed_at = ?, completed_by = ?, notes = ?, updated_at = ? WHERE id = ?',
      ['COMPLETED', now, completedBy, notes, now, id]
    );
    
    logger.info(`Task completed: ${id} by ${completedBy}`);
    return await this.findById(id);
  }

  /**
   * Delete task
   */
  static async delete(id) {
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    logger.info(`Task deleted: ${id}`);
  }

  /**
   * Convert database row to task object
   */
  static deserialize(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      supplierId: row.supplier_id,
      taskType: row.task_type,
      description: row.description,
      assignedTo: row.assigned_to,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      notes: row.notes
    };
  }
}

module.exports = TaskModel;
