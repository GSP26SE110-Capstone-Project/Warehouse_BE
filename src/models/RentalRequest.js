/**
 * RentalRequest Schema - Yêu cầu thuê kho
 * Khi tenant muốn thuê kho, họ tạo một yêu cầu
 * Admin sẽ duyệt (APPROVED) hoặc từ chối (REJECTED)
 */
export const rentalRequestSchema = {
  requestId: {
    type: 'string',
    primaryKey: true,
  },
  customerType: {
    type: 'enum',
    enum: ['individual', 'business'],
    required: true,
    note: 'Loại khách hàng đăng ký thuê kho',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id - Tenant tạo yêu cầu thuê',
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
    note: 'Kho mà khách hàng muốn thuê',
  },
  rentalType: {
    type: 'enum',
    enum: ['RACK', 'LEVEL'],
    required: true,
    default: 'RACK',
    note: 'Tenant chỉ nêu nhu cầu ở mức rack hoặc level; admin sẽ phân bổ cụ thể',
  },
  status: {
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  requestedStartDate: {
    type: 'date',
    required: true,
    note: 'Ngày bắt đầu thuê dự kiến',
  },
  rentalTermUnit: {
    type: 'enum',
    enum: ['MONTH', 'QUARTER', 'YEAR'],
    required: true,
    note: 'Kỳ hạn thuê theo nghiệp vụ',
  },
  rentalTermValue: {
    type: 'integer',
    required: true,
    min: 1,
    note: 'Số kỳ thuê, ví dụ 3 MONTH hoặc 1 YEAR',
  },
  durationDays: {
    type: 'integer',
    required: false,
    note: 'Số ngày quy đổi nội bộ từ rentalTermUnit + rentalTermValue',
  },
  goodsType: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  goodsDescription: {
    type: 'text',
    required: false,
  },
  goodsQuantity: {
    type: 'number',
    required: true,
    min: 0.000001,
  },
  goodsWeightKg: {
    type: 'number',
    required: true,
    min: 0,
    note: 'Tổng trọng lượng hàng hóa (kg)',
  },
  notes: {
    type: 'text',
    required: false,
    note: 'Ghi chú của tenant về nhu cầu',
  },
  approvedBy: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Admin duyệt yêu cầu',
  },
  rejectedReason: {
    type: 'text',
    required: false,
    note: 'Lý do từ chối nếu status = REJECTED',
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

export const tableName = 'rental_requests';

export default rentalRequestSchema;

