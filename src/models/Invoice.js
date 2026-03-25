/**
 * Invoice Schema - Hóa đơn thanh toán
 * Để tracking bill cho mỗi hợp đồng thuê kho
 */
export const invoiceSchema = {
  invoiceId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
    note: 'ref Contract.contract_id - Hợp đồng này',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id - Công ty thuê kho',
  },
  invoiceCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  invoiceType: {
    type: 'enum',
    enum: ['RENTAL', 'TRANSPORTATION', 'DEPOSIT', 'OTHER'],
    required: false,
  },
  invoiceDate: {
    type: 'date',
    required: true,
    note: 'Ngày phát hành hóa đơn',
  },
  dueDate: {
    type: 'date',
    required: true,
    note: 'Hạn thanh toán',
  },
  subtotal: {
    type: 'number',
    required: true,
    note: 'Tiền hóa đơn trước thuế (VND)',
  },
  taxPercentage: {
    type: 'number',
    default: 10,
  },
  taxAmount: {
    type: 'number',
    required: true,
    note: 'Tiền thuế (VND)',
  },
  totalAmount: {
    type: 'number',
    required: true,
    note: 'Tổng tiền hóa đơn (VND)',
  },
  paidAmount: {
    type: 'number',
    default: 0,
  },
  status: {
    type: 'enum',
    enum: ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'],
    default: 'DRAFT',
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

export const tableName = 'invoices';

export default invoiceSchema;

