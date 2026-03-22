/**
 * TransportProvider Schema - Đơn vị vận chuyển
 * Có thể là đơn vị nội bộ (của kho) hoặc bên thứ 3
 */
export const transportationProviderSchema = {
  providerId: {
    type: 'string',
    primaryKey: true,
  },
  name: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  providerType: {
    type: 'enum',
    enum: ['INTERNAL', 'EXTERNAL'],
    required: false,
    note: 'INTERNAL = của kho, EXTERNAL = bên thứ 3',
  },
  contactInfo: {
    type: 'string',
    required: false,
    maxLength: 255,
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

export const tableName = 'transportation_providers';

export default transportationProviderSchema;

