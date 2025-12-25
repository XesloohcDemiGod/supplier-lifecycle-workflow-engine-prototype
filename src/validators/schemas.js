/**
 * Validation Schemas using Joi
 * Input validation for all API endpoints
 */

const Joi = require('joi');
const config = require('../config');

// Custom validators
const validators = {
  // Email validation
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .max(255)
    .messages({
      'string.email': 'Must be a valid email address',
      'string.max': 'Email must not exceed 255 characters'
    }),

  // Phone validation (international format)
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .trim()
    .max(20)
    .messages({
      'string.pattern.base': 'Phone must be in international format (e.g., +1234567890)',
      'string.max': 'Phone number must not exceed 20 characters'
    }),

  // Tax ID validation (US format: XX-XXXXXXX)
  taxId: Joi.string()
    .pattern(/^\d{2}-\d{7}$/)
    .messages({
      'string.pattern.base': 'Tax ID must be in format XX-XXXXXXX (e.g., 12-3456789)'
    }),

  // ERP ID validation
  erpId: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .messages({
      'string.alphanum': 'ERP ID must contain only alphanumeric characters',
      'string.min': 'ERP ID must be at least 3 characters',
      'string.max': 'ERP ID must not exceed 50 characters'
    }),

  // Company name
  companyName: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^[a-zA-Z0-9\s\-&.,'"()]+$/)
    .required()
    .messages({
      'string.min': 'Company name must be at least 2 characters',
      'string.max': 'Company name must not exceed 255 characters',
      'string.pattern.base': 'Company name contains invalid characters',
      'any.required': 'Company name is required'
    }),

  // Username
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username must not exceed 30 characters',
      'any.required': 'Username is required'
    }),

  // Password
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    }),

  // Role
  role: Joi.string()
    .valid('Buyer', 'Supplier', 'Reviewer', 'Finance', 'Admin')
    .required()
    .messages({
      'any.only': 'Role must be one of: Buyer, Supplier, Reviewer, Finance, Admin',
      'any.required': 'Role is required'
    }),

  // State
  state: Joi.string()
    .valid(
      'REQUESTED',
      'PENDING_REGISTRATION',
      'REGISTERED',
      'UNDER_REVIEW',
      'APPROVED_FOR_ERP',
      'ERP_SYNC_IN_PROGRESS',
      'ERP_SYNCED',
      'UNDER_QUALIFICATION',
      'QUALIFIED',
      'DISQUALIFIED',
      'REJECTED',
      'INACTIVE'
    ),

  // UUID
  uuid: Joi.string()
    .guid({ version: 'uuidv4' })
    .messages({
      'string.guid': 'Must be a valid UUID'
    }),

  // Safe string (for general text inputs)
  safeString: (maxLength = 255) => Joi.string()
    .trim()
    .max(maxLength)
    .pattern(/^[a-zA-Z0-9\s\-_.,'"\n\r]+$/)
    .messages({
      'string.max': `Must not exceed ${maxLength} characters`,
      'string.pattern.base': 'Contains invalid characters'
    }),

  // Array with max items
  limitedArray: (itemSchema, maxItems = config.security.maxArraySize) => Joi.array()
    .items(itemSchema)
    .max(maxItems)
    .messages({
      'array.max': `Array must not exceed ${maxItems} items`
    })
};

// Schemas for different endpoints

// Authentication schemas
const authSchemas = {
  register: Joi.object({
    username: validators.username,
    email: validators.email.required(),
    password: validators.password,
    role: validators.role
  }),

  login: Joi.object({
    username: validators.username,
    password: validators.password
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  })
};

// Supplier schemas
const supplierSchemas = {
  createRequest: Joi.object({
    companyName: validators.companyName,
    contactEmail: validators.email.required(),
    contactPhone: validators.phone.optional().allow(null, ''),
    categories: validators.limitedArray(
      Joi.string().trim().max(100).pattern(/^[a-zA-Z0-9\s\-_]+$/),
      config.security.maxArraySize
    ).default([]),
    businessType: Joi.string().trim().max(100).pattern(/^[a-zA-Z0-9\s\-_&.]+$/).optional().allow(null, ''),
    requestedBy: Joi.string().required()
  }),

  register: Joi.object({
    contactEmail: validators.email.required(),
    taxId: validators.taxId.optional().allow(null, ''),
    businessType: Joi.string().trim().max(100).pattern(/^[a-zA-Z0-9\s\-_&.]+$/).optional().allow(null, ''),
    address: Joi.object({
      street: Joi.string().trim().max(255).pattern(/^[a-zA-Z0-9\s\-_.,#]+$/).optional().allow(null, ''),
      city: Joi.string().trim().max(100).pattern(/^[a-zA-Z\s\-]+$/).optional().allow(null, ''),
      state: Joi.string().trim().max(100).pattern(/^[a-zA-Z\s\-]+$/).optional().allow(null, ''),
      zip: Joi.string().trim().max(20).pattern(/^[a-zA-Z0-9\s\-]+$/).optional().allow(null, ''),
      country: Joi.string().trim().max(100).pattern(/^[a-zA-Z\s\-]+$/).optional().allow(null, '')
    }).optional()
  }),

  sendInvite: Joi.object({
    // User is determined from JWT token, no need to send in body
  }),

  review: Joi.object({
    reviewer: Joi.string().required()
  }),

  approve: Joi.object({
    reviewer: Joi.string().required(),
    notes: Joi.string().trim().max(1000).optional().allow(null, '')
  }),

  reject: Joi.object({
    user: Joi.string().required(),
    reason: Joi.string().trim().min(10).max(1000).required().messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'any.required': 'Rejection reason is required'
    })
  }),

  erpSyncStart: Joi.object({
    user: Joi.string().required()
  }),

  erpSyncComplete: Joi.object({
    erpId: validators.erpId.required(),
    user: Joi.string().required()
  }),

  qualificationStart: Joi.object({
    user: Joi.string().required()
  }),

  qualify: Joi.object({
    score: Joi.number().min(0).max(100).required().messages({
      'number.min': 'Qualification score must be between 0 and 100',
      'number.max': 'Qualification score must be between 0 and 100',
      'any.required': 'Qualification score is required'
    }),
    user: Joi.string().required(),
    notes: Joi.string().trim().max(1000).optional().allow(null, '')
  }),

  disqualify: Joi.object({
    score: Joi.number().min(0).max(100).required(),
    user: Joi.string().required(),
    notes: Joi.string().trim().min(10).max(1000).required().messages({
      'string.min': 'Disqualification notes must be at least 10 characters',
      'any.required': 'Disqualification notes are required'
    })
  }),

  deactivate: Joi.object({
    user: Joi.string().required(),
    reason: Joi.string().trim().min(10).max(1000).required().messages({
      'string.min': 'Deactivation reason must be at least 10 characters',
      'any.required': 'Deactivation reason is required'
    })
  })
};

// Task schemas
const taskSchemas = {
  complete: Joi.object({
    user: Joi.string().required(),
    notes: Joi.string().trim().max(1000).optional().allow(null, '')
  })
};

// Query parameter schemas
const querySchemas = {
  supplierState: Joi.object({
    state: validators.state.optional()
  }),

  taskStatus: Joi.object({
    supplierId: validators.uuid.optional(),
    status: Joi.string().valid('PENDING', 'COMPLETED', 'CANCELLED').optional()
  })
};

module.exports = {
  validators,
  authSchemas,
  supplierSchemas,
  taskSchemas,
  querySchemas
};
