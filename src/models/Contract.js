/**
 * Contract Schema - Hợp đồng thuê kho
 * Sau khi yêu cầu thuê kho được duyệt, sẽ tạo một hợp đồng
 * Hợp đồng có hiệu lực sau 1 tuần kể từ ngày được duyệt
 */
export const contractSchema = {
  contractId: {
    type: 'string',
    primaryKey: true,
  },
  requestId: {
    type: 'string',
    required: false,
    foreignKey: 'request_id',
    note: 'ref RentalRequest.request_id - Yêu cầu thuê kho gốc',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id - Công ty thuê kho',
  },
  approvedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Admin duyệt hợp đồng',
  },
  contractCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  startDate: {
    type: 'date',
    required: true,
    note: 'Ngày bắt đầu có hiệu lực (có thể > requested_start_date)',
  },
  endDate: {
    type: 'date',
    required: true,
  },
  billingCycle: {
    type: 'enum',
    enum: ['QUARTER', 'MONTH', 'YEAR', 'CUSTOM'],
    required: false,
    note: 'Chu kỳ thanh toán',
  },
  rentalDurationDays: {
    type: 'integer',
    required: false,
    note: '< 30 ngày hoặc > 30 ngày để áp dụng giá khác',
  },
  totalRentalFee: {
    type: 'number',
    required: true,
    note: 'Tổng tiền thuê kho',
  },
  contractFileUrl: {
    type: 'string',
    required: false,
    maxLength: 1000,
    note: 'Link file hop dong gui cho tenant',
  },
  sentAt: {
    type: 'datetime',
    required: false,
    note: 'Thoi diem admin gui hop dong cho tenant',
  },
  tenantSignedAt: {
    type: 'datetime',
    required: false,
    note: 'Thoi diem tenant ky hop dong',
  },
  signedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'User tenant ky hop dong',
  },
  signatureMethod: {
    type: 'enum',
    enum: ['E_SIGN', 'CONFIRM'],
    required: false,
  },
  status: {
    type: 'enum',
    enum: ['DRAFT', 'SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
    default: 'DRAFT',
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

export const tableName = 'contracts';

export default contractSchema;

