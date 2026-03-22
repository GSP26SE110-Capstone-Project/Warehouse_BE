/**
 * Tenant Schema - Công ty thuê kho
 * Màu tenant là công ty/doanh nghiệp muốn thuê kho từ hệ thống
 */
export const tenantSchema = {
  tenantId: {
    type: 'string',
    primaryKey: true,
  },
  companyName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  taxCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  contactEmail: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 255,
  },
  contactPhone: {
    type: 'string',
    required: false,
    maxLength: 20,
  },
  address: {
    type: 'text',
    required: false,
  },
  isActive: {
    type: 'boolean',
    default: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'tenants';

export default tenantSchema;
