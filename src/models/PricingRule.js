/**
 * PricingRule Schema - Quy tắc giá thuê kho
 * Quản lý giá theo: khoảng thời gian, loại kho, kích thước, loại cho thuê
 */
export const pricingRuleSchema = {
  pricingRuleId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: false,
    foreignKey: 'warehouse_id',
    note: 'ref Warehouse.warehouse_id - Kho áp dụng giá này (có thể null)',
  },
  zoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
    note: 'ref Zone.zone_id - Zone áp dụng (có thể null)',
  },
  rentType: {
    type: 'enum',
    enum: ['ENTIRE_WAREHOUSE', 'ZONE', 'SLOT'],
    default: 'ZONE',
    note: 'Loại cho thuê áp dụng giá này',
  },
  minDays: {
    type: 'integer',
    required: false,
    note: 'Số ngày tối thiểu',
  },
  maxDays: {
    type: 'integer',
    required: false,
    note: 'Số ngày tối đa (null = không giới hạn)',
  },
  pricePerDay: {
    type: 'number',
    required: false,
    note: 'Giá mỗi ngày (VND)',
  },
  pricePerM2: {
    type: 'number',
    required: false,
    note: 'Giá per m² (VND)',
  },
  pricePerPallet: {
    type: 'number',
    required: false,
    note: 'Giá per pallet/slot (VND)',
  },
  billingCycle: {
    type: 'enum',
    enum: ['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    required: false,
  },
  bulkDiscountPct: {
    type: 'number',
    required: false,
    note: 'Chiết khấu tập hợp (%)',
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

