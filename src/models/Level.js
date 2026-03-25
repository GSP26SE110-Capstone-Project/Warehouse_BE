/**
 * Level Schema - Tầng trong một rack
 * Rack được chia làm nhiều tầng, mỗi tầng có nhiều slot
 */
export const levelSchema = {
  levelId: {
    type: 'string',
    primaryKey: true,
  },
  rackId: {
    type: 'string',
    required: true,
    foreignKey: 'rack_id',
    note: 'ref Rack.rack_id',
  },
  levelNumber: {
    type: 'integer',
    required: true,
    note: '1, 2, 3... số thứ tự từ dưới lên trên',
  },
  heightClearance: {
    type: 'number',
    required: false,
    note: 'Khoảng sáng chiều cao của tầng (mét)',
  },
  maxWeight: {
    type: 'number',
    required: false,
    note: 'Trọng lượng tối đa cho tầng này (kg)',
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

export const tableName = 'levels';

export default levelSchema;
