/**
 * Payment Schema - Thanh toán cho hóa đơn/hợp đồng
 * Tracking chi tiết từng khoản thanh toán
 */
export const paymentSchema = {
  paymentId: {
    type: 'string',
    primaryKey: true,
  },
  invoiceId: {
    type: 'string',
    required: false,
    foreignKey: 'invoice_id',
    note: 'ref Invoice.invoice_id - Hóa đơn này',
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
    note: 'ref Contract.contract_id - Hợp đồng thanh toán',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id - Công ty thiệu toán',
  },
  paymentCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  paymentDate: {
    type: 'date',
    required: true,
  },
  amount: {
    type: 'number',
    required: true,
    note: 'Số tiền thanh toán (VND)',
  },
  paymentMethod: {
    type: 'enum',
    enum: ['BANK_TRANSFER', 'CASH', 'CHECK', 'CREDIT_CARD', 'DIGITAL_WALLET'],
    required: true,
  },
  transactionCode: {
    type: 'string',
    required: false,
    maxLength: 100,
    note: 'Mã giao dịch từ ngân hàng/sàn',
  },
  status: {
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
  },
  processedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Người xử lý thanh toán',
  },
  notes: {
    type: 'text',
    required: false,
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

export const tableName = 'payments';

export default paymentSchema;

