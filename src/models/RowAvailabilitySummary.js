export const rowAvailabilitySummarySchema = {
  summaryId: {
    type: 'string',
    primaryKey: true,
  },
  rowId: {
    type: 'string',
    required: true,
  },
  totalPositions: {
    type: 'integer',
    required: false,
  },
  availablePositions: {
    type: 'integer',
    required: false,
  },
  occupiedPositions: {
    type: 'integer',
    required: false,
  },
  reservedPositions: {
    type: 'integer',
    required: false,
  },
  maintenancePositions: {
    type: 'integer',
    required: false,
  },
  utilizationPct: {
    type: 'number',
    required: false,
  },
  isFullyAvailable: {
    type: 'boolean',
    required: false,
  },
  isPartiallyAvailable: {
    type: 'boolean',
    required: false,
  },
  monthlyRevenue: {
    type: 'number',
    required: false,
  },
  lastUpdated: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'row_availability_summaries';

export default rowAvailabilitySummarySchema;

