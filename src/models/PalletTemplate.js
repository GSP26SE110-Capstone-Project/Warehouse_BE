export const palletTemplateSchema = {
  templateId: {
    type: 'string',
    primaryKey: true,
  },
  templateName: {
    type: 'string',
    required: true,
  },
  palletLength: {
    type: 'number',
    required: true,
  },
  palletWidth: {
    type: 'number',
    required: true,
  },
  palletHeightPerLevel: {
    type: 'number',
    required: true,
  },
  maxLevels: {
    type: 'integer',
    required: true,
  },
  maxWeightPerLevel: {
    type: 'number',
    required: false,
  },
  totalFootprint: {
    type: 'number',
    required: false,
  },
  isActive: {
    type: 'boolean',
    default: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'pallet_templates';

export default palletTemplateSchema;

