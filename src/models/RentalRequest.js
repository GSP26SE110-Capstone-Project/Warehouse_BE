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
  tenantId: {
    type: 'string',
    required: true,
    note: 'ref Tenant.tenant_id - Công ty muốn thuê',
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
  durationDays: {
    type: 'integer',
    required: true,
    note: 'Số ngày muốn thuê (ít nhất 15 ngày)',
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

