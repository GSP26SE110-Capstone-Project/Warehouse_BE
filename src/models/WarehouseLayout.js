export const warehouseLayoutSchema = {
  layoutId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
  },
  palletTemplateId: {
    type: 'string',
    required: false,
  },
  aisleWidth: {
    type: 'number',
    required: true,
  },
  numberOfAisles: {
    type: 'integer',
    required: false,
  },
  totalPalletsCapacity: {
    type: 'integer',
    required: false,
  },
  palletsPerRow: {
    type: 'integer',
    required: false,
  },
  numberOfRows: {
    type: 'integer',
    required: false,
  },
  layoutEfficiencyPercentage: {
    type: 'number',
    required: false,
  },
  layoutDiagramUrl: {
    type: 'string',
    required: false,
  },
  suggestedByAi: {
    type: 'boolean',
    default: false,
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

export const tableName = 'warehouse_layouts';

export default warehouseLayoutSchema;

