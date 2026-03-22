/**
 * TransportStation Schema - Trạm vận chuyển
 * Dùng để quản lý các trạm vận chuyển của nhà kho
 * Một transport provider có thể có nhiều stations
 */
export const transportStationSchema = {
  stationId: {
    type: 'string',
    primaryKey: true,
  },
  providerId: {
    type: 'string',
    required: true,
    note: 'ref TransportProvider.provider_id',
  },
  stationName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  address: {
    type: 'text',
    required: false,
  },
  managerId: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Người quản lý trạm',
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

export const tableName = 'transport_stations';

export default transportStationSchema;
