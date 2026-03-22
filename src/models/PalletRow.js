export const palletRowSchema = {
  rowId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
  },
  aisleId: {
    type: 'string',
    required: false,
  },
  rowCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  rowName: {
    type: 'string',
    required: false,
  },
  physicalRowNumber: {
    type: 'integer',
    required: false,
  },
  startColumn: {
    type: 'integer',
    required: false,
  },
  endColumn: {
    type: 'integer',
    required: false,
  },
  totalPositions: {
    type: 'integer',
    required: false,
  },
  isRowRentalEnabled: {
    type: 'boolean',
    default: true,
  },
  minPositionsForRowRental: {
    type: 'integer',
    default: 5,
  },
  rowRentalDiscountPct: {
    type: 'number',
    default: 10,
  },
  availablePositions: {
    type: 'integer',
    required: false,
  },
  occupiedPositions: {
    type: 'integer',
    required: false,
  },
  reservedPositions: {
    type: 'integer',
    required: false,
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

export const tableName = 'pallet_rows';

export default palletRowSchema;

