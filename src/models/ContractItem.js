/**
 * ContractItem Schema - Từng mục trong hợp đồng
 * Một hợp đồng có thể chứa nhiều item:
 * - Thuê toàn warehouse
 * - Thuê zone
 * - Thuê slot
 */
export const contractItemSchema = {
  itemId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
    note: 'ref Contract.contract_id',
  },
  rentType: {
    type: 'enum',
    enum: ['ENTIRE_WAREHOUSE', 'ZONE', 'SLOT'],
    required: true,
  },
  warehouseId: {
    type: 'string',
    required: false,
    foreignKey: 'warehouse_id',
    note: 'ref Warehouse.warehouse_id - Nếu rentType = ENTIRE_WAREHOUSE',
  },
  zoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
    note: 'ref Zone.zone_id - Nếu rentType = ZONE',
  },
  slotId: {
    type: 'string',
    required: false,
    foreignKey: 'slot_id',
    note: 'ref Slot.slot_id - Nếu rentType = SLOT',
  },
  unitPrice: {
    type: 'number',
    required: true,
    note: 'Giá thuê cho item này (tính theo thời kỳ)',
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

export const tableName = 'contract_items';

export default contractItemSchema;
