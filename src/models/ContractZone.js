export const contractZoneSchema = {
  contractZoneId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
  },
  zoneId: {
    type: 'string',
    required: true,
  },
  rentalType: {
    type: 'enum',
    enum: ['individual', 'row', 'full_warehouse'],
    default: 'individual',
  },
  rowId: {
    type: 'string',
    required: false,
  },
  monthlyPrice: {
    type: 'number',
    required: true,
  },
  isFullWarehouse: {
    type: 'boolean',
    default: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'contract_zones';

export default contractZoneSchema;

