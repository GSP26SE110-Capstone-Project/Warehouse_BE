export const rentalRequestZoneSchema = {
  requestZoneId: {
    type: 'string',
    primaryKey: true,
  },
  rentalRequestId: {
    type: 'string',
    required: true,
  },
  zoneId: {
    type: 'string',
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

export const tableName = 'rental_request_zones';

export default rentalRequestZoneSchema;

