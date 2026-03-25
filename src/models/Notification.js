/**
 * Notification Schema - Thông báo cho người dùng
 */
export const notificationSchema = {
  notificationId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: true,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Gửi đến user nào',
  },
  type: {
    type: 'enum',
    enum: [
      'CONTRACT_EXPIRING',
      'REQUEST_STATUS',
      'SHIPMENT_TRACKING',
      'PROMOTION',
      'EMPTY_WAREHOUSE'
    ],
    required: false,
  },
  title: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  content: {
    type: 'text',
    required: true,
    note: 'Nội dung chi tiết của thông báo',
  },
  isRead: {
    type: 'boolean',
    default: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'notifications';

export default notificationSchema;

