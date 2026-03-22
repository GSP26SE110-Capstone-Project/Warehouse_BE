export const paymentSchema = {
  paymentId: {
    type: 'string',
    primaryKey: true,
  },
  invoiceId: {
    type: 'string',
    required: true,
  },
  companyId: {
    type: 'string',
    required: true,
  },
  paymentNumber: {
    type: 'string',
    required: true,
    unique: true,
  },
  paymentDate: {
    type: 'date',
    required: true,
  },
  amount: {
    type: 'number',
    required: true,
  },
  paymentMethod: {
    type: 'enum',
    enum: ['bank_transfer', 'cash', 'credit_card', 'check'],
    required: false,
  },
  transactionReference: {
    type: 'string',
    required: false,
  },
  notes: {
    type: 'text',
    required: false,
  },
  processedBy: {
    type: 'string',
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

