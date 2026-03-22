/**
 * Rack Schema - Cái kệ/halô kho
 * Một zone chứa nhiều rack, mỗi rack có nhiều tầng
 */
export const rackSchema = {
  rackId: {
    type: 'string',
    primaryKey: true,
  },
  zoneId: {
    type: 'string',
    required: true,
    note: 'ref Zone.zone_id',
  },
  rackCode: {
    type: 'string',
    required: true,
    maxLength: 50,
    note: 'e.g., A1-R1, A2-R2',
  },
  rackSizeType: {
    type: 'enum',
    enum: ['small', 'medium', 'large'],
    required: false,
  },
  length: {
    type: 'number',
    required: true,
    note: 'Chiều dài tính bằng mét',
  },
  width: {
    type: 'number',
    required: true,
    note: 'Chiều rộng tính bằng mét',
  },
  height: {
    type: 'number',
    required: true,
    note: 'Chiều cao tính bằng mét',
  },
  maxWeightCapacity: {
    type: 'number',
    required: false,
    note: 'Sức chứa tối đa tính bằng kg',
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

export const tableName = 'racks';

export default rackSchema;
