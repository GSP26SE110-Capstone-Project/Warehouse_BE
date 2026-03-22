export const promotionSchema = {
  promotionId: {
    type: 'string',
    primaryKey: true,
  },
  promotionCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  title: {
    type: 'string',
    required: true,
  },
  description: {
    type: 'text',
    required: false,
  },
  discountType: {
    type: 'enum',
    enum: ['percentage', 'fixed_amount'],
    required: true,
  },
  discountValue: {
    type: 'number',
    required: true,
  },
  appliesTo: {
    type: 'enum',
    enum: ['rental', 'transportation', 'both'],
    required: false,
  },
  minRentalMonths: {
    type: 'integer',
    required: false,
  },
  minZonesCount: {
    type: 'integer',
    required: false,
  },
  warehouseId: {
    type: 'string',
    required: false,
  },
  validFrom: {
    type: 'date',
    required: true,
  },
  validTo: {
    type: 'date',
    required: true,
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

export const tableName = 'promotions';

export default promotionSchema;

