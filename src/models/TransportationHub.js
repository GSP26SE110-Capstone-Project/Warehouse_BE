export const transportationHubSchema = {
  hubId: {
    type: 'string',
    primaryKey: true,
  },
  providerId: {
    type: 'string',
    required: false,
  },
  hubName: {
    type: 'string',
    required: true,
  },
  hubCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  address: {
    type: 'text',
    required: true,
  },
  city: {
    type: 'string',
    required: false,
  },
  latitude: {
    type: 'number',
    required: false,
  },
  longitude: {
    type: 'number',
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

export const tableName = 'transportation_hubs';

export default transportationHubSchema;

