export const importExportRecordSchema = {
  recordId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
  },
  zoneId: {
    type: 'string',
    required: true,
  },
  recordType: {
    type: 'enum',
    enum: ['import', 'export'],
    required: true,
  },
  recordCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  scheduledDatetime: {
    type: 'datetime',
    required: true,
  },
  actualDatetime: {
    type: 'datetime',
    required: false,
  },
  quantity: {
    type: 'number',
    required: false,
  },
  weight: {
    type: 'number',
    required: false,
  },
  isFullZone: {
    type: 'boolean',
    default: false,
  },
  responsibleStaffId: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'enum',
    enum: ['pending', 'approved', 'completed', 'cancelled'],
    default: 'pending',
  },
  notes: {
    type: 'text',
    required: false,
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

export const tableName = 'import_export_records';

export default importExportRecordSchema;

