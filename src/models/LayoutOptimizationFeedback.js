export const layoutOptimizationFeedbackSchema = {
  feedbackId: {
    type: 'string',
    primaryKey: true,
  },
  optimizationId: {
    type: 'string',
    required: true,
  },
  userId: {
    type: 'string',
    required: true,
  },
  wasAccepted: {
    type: 'boolean',
    required: false,
  },
  actualPalletsUsed: {
    type: 'integer',
    required: false,
  },
  userNotes: {
    type: 'text',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'layout_optimization_feedbacks';

export default layoutOptimizationFeedbackSchema;

