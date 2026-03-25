/**
 * AuditLog Schema - Log lịch sử
 * Để tracking tất cả hành động quan trọng trong hệ thống
 * Phục vụ cho audit, phân tích, và khôi phục dữ liệu
 */
export const auditLogSchema = {
  logId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Người thực hiện hành động',
  },
  action: {
    type: 'enum',
    enum: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT'],
    required: true,
  },
  entityType: {
    type: 'string',
    required: true,
    maxLength: 100,
    note: 'Loại entity: Contract, RentalRequest, Invoice, Shipment, etc',
  },
  entityId: {
    type: 'string',
    required: true,
    note: 'ID của entity bị thay đổi',
  },
  oldValue: {
    type: 'json',
    required: false,
    note: 'Giá trị cũ (JSON) - chỉ áp dụng cho UPDATE',
  },
  newValue: {
    type: 'json',
    required: false,
    note: 'Giá trị mới (JSON)',
  },
  description: {
    type: 'text',
    required: false,
    note: 'Mô tả chi tiết hành động',
  },
  ipAddress: {
    type: 'string',
    required: false,
    maxLength: 50,
  },
  userAgent: {
    type: 'string',
    required: false,
    note: 'Browser/User-Agent info',
  },
  timestamp: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'audit_logs';

export default auditLogSchema;
