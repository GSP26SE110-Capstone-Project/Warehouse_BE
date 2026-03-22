export const transportationPriceRuleSchema = {
  priceRuleId: {
    type: 'string',
    primaryKey: true,
  },
  providerId: {
    type: 'string',
    required: true,
  },
  weightFrom: {
    type: 'number',
    required: true,
  },
  weightTo: {
    type: 'number',
    required: true,
  },
  distanceFrom: {
    type: 'number',
    required: true,
  },
  distanceTo: {
    type: 'number',
    required: true,
  },
  basePrice: {
    type: 'number',
    required: true,
  },
  pricePerKm: {
    type: 'number',
    required: true,
  },
  pricePerKg: {
    type: 'number',
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

export const tableName = 'transportation_price_rules';

export default transportationPriceRuleSchema;

