export const pricingRuleSchema = {
  pricingRuleId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: false,
  },
  zoneId: {
    type: 'string',
    required: false,
  },
  rowId: {
    type: 'string',
    required: false,
  },
  rentalType: {
    type: 'enum',
    enum: ['individual', 'row', 'bulk'],
    default: 'individual',
  },
  rentalDurationType: {
    type: 'enum',
    enum: ['monthly', 'quarterly', 'yearly', 'custom'],
    required: false,
  },
  pricePerM2: {
    type: 'number',
    required: false,
  },
  pricePerPallet: {
    type: 'number',
    required: false,
  },
  minPositions: {
    type: 'integer',
    required: false,
  },
  maxPositions: {
    type: 'integer',
    required: false,
  },
  bulkDiscountPct: {
    type: 'number',
    required: false,
  },
  minDays: {
    type: 'integer',
    required: false,
  },
  maxDays: {
    type: 'integer',
    required: false,
  },
  discountPercentage: {
    type: 'number',
    default: 0,
  },
  isActive: {
    type: 'boolean',
    default: true,
  },
  effectiveFrom: {
    type: 'date',
    required: true,
  },
  effectiveTo: {
    type: 'date',
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

export const tableName = 'pricing_rules';

export default pricingRuleSchema;

