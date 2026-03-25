/**
 * Branch Schema - Chi nhánh kho
 * Một doanh nghiệp chủ quản có thể có nhiều chi nhánh/kho tại các địa điểm khác nhau
 */
export const branchSchema = {
  branchId: {
    type: 'string',
    primaryKey: true,
  },
  managerId: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'Người quản lý chi nhánh - ref User.user_id',
  },
  branchCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  branchName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  address: {
    type: 'text',
    required: true,
  },
  city: {
    type: 'string',
    required: false,
    maxLength: 100,
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

export const tableName = 'branches';

export default branchSchema;
