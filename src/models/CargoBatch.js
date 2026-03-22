export const cargoBatchSchema = {
  batchId: {
    type: 'string',
    primaryKey: true,
  },
  importRecordId: {
    type: 'string',
    required: true,
  },
  batchCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  qrCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  description: {
    type: 'text',
    required: false,
  },
  quantity: {
    type: 'number',
    required: false,
  },
  weight: {
    type: 'number',
    required: false,
  },
  declaredValue: {
    type: 'number',
    required: false,
  },
  isHazardous: {
    type: 'boolean',
    default: false,
  },
  isPerishable: {
    type: 'boolean',
    default: false,
  },
  isExported: {
    type: 'boolean',
    default: false,
  },
  exportRecordId: {
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

export const tableName = 'cargo_batches';

export default cargoBatchSchema;

