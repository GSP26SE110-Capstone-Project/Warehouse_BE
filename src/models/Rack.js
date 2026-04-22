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
    foreignKey: 'zone_id',
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
    min: 0.000001,
    note: 'Chiều dài tính bằng mét',
  },
  width: {
    type: 'number',
    required: true,
    min: 0.000001,
    note: 'Chiều rộng tính bằng mét',
  },
  height: {
    type: 'number',
    required: true,
    min: 0.000001,
    note: 'Chiều cao tính bằng mét',
  },
  maxWeightCapacity: {
    type: 'number',
    required: false,
    min: 0,
    note: 'Sức chứa tối đa tính bằng kg',
  },
  isRented: {
    type: 'boolean',
    default: false,
    note: 'Rack đang được thuê hay chưa',
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
