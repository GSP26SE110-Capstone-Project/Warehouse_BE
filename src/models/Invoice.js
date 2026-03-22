export const invoiceSchema = {
  invoiceId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: false,
  },
  companyId: {
    type: 'string',
    required: true,
  },
  invoiceNumber: {
    type: 'string',
    required: true,
    unique: true,
  },
  invoiceType: {
    type: 'enum',
    enum: ['rental', 'transportation', 'deposit', 'other'],
    required: false,
  },
  invoiceDate: {
    type: 'date',
    required: true,
  },
  dueDate: {
    type: 'date',
    required: true,
  },
  subtotal: {
    type: 'number',
    required: true,
  },
  taxPercentage: {
    type: 'number',
    default: 10,
  },
  taxAmount: {
    type: 'number',
    required: true,
  },
  totalAmount: {
    type: 'number',
    required: true,
  },
  paidAmount: {
    type: 'number',
    default: 0,
  },
  balanceAmount: {
    type: 'number',
    required: true,
  },
  status: {
    type: 'enum',
    enum: ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'unpaid',
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

