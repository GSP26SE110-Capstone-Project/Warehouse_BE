export const contractRowSchema = {
  contractRowId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
  },
  rowId: {
    type: 'string',
    required: true,
  },
  positionsRented: {
    type: 'integer',
    required: false,
  },
  pricePerPosition: {
    type: 'number',
    required: false,
  },
  discountApplied: {
    type: 'number',
    required: false,
  },
  totalMonthlyPrice: {
    type: 'number',
    required: false,
  },
  startDate: {
    type: 'date',
    required: true,
  },
  endDate: {
    type: 'date',
    required: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'contract_rows';

export default contractRowSchema;

