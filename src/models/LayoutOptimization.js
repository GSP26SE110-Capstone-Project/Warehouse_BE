export const layoutOptimizationSchema = {
  optimizationId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
  },
  inputLength: {
    type: 'number',
    required: true,
  },
  inputWidth: {
    type: 'number',
    required: true,
  },
  inputHeight: {
    type: 'number',
    required: true,
  },
  selectedPalletTemplateId: {
    type: 'string',
    required: false,
  },
  aisleWidthSuggestion: {
    type: 'number',
    required: false,
  },
  totalPalletsSuggested: {
    type: 'integer',
    required: false,
  },
  layoutEfficiency: {
    type: 'number',
    required: false,
  },
  ragModelVersion: {
    type: 'string',
    required: false,
  },
  ragConfidenceScore: {
    type: 'number',
    required: false,
  },
  optimizationReasoning: {
    type: 'text',
    required: false,
  },
  alternativeLayouts: {
    type: 'json',
    required: false,
  },
  createdBy: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'layout_optimizations';

export default layoutOptimizationSchema;

