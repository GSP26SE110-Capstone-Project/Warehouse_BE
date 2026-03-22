/**
 * Slot Schema - Ô/vị trí lưu trữ
 * Là đơn vị nhỏ nhất có thể cho thuê
 * Một slot có thể được thuê bởi một tenant/công ty
 */
export const slotSchema = {
  slotId: {
    type: 'string',
    primaryKey: true,
  },
  levelId: {
    type: 'string',
    required: true,
    note: 'ref Level.level_id',
  },
  slotCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
    note: 'e.g., A1-R1-L1-S1',
  },
  length: {
    type: 'number',
    required: true,
    note: 'Chiều dài (mét)',
  },
  width: {
    type: 'number',
    required: true,
    note: 'Chiều rộng (mét)',
  },
  height: {
    type: 'number',
    required: true,
    note: 'Chiều cao (mét)',
  },
  volume: {
    type: 'number',
    required: false,
    note: 'Thể tích = length x width x height (m³)',
  },
  status: {
    type: 'enum',
    enum: ['EMPTY', 'RENTED', 'MAINTENANCE'],
    default: 'EMPTY',
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

export const tableName = 'slots';

export default slotSchema;
