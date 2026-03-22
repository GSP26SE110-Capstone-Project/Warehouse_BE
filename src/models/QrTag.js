/**
 * QrTag Schema - Mã QR theo dõi hàng hóa
 * Mỗi lô hàng/pallet khi nhập kho sẽ được dán mã QR để theo dõi
 */
export const qrTagSchema = {
  tagId: {
    type: 'string',
    primaryKey: true,
  },
  shipmentId: {
    type: 'string',
    required: true,
    note: 'ref Shipment.shipment_id - Lô hàng vận chuyển này',
  },
  slotId: {
    type: 'string',
    required: false,
    note: 'ref Slot.slot_id - Slot nơi hàng được lưu trữ',
  },
  qrCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  productDetails: {
    type: 'text',
    required: false,
    note: 'Mô tả chi tiết lô hàng/pallet này',
  },
  status: {
    type: 'enum',
    enum: ['IN_TRANSIT', 'STORED', 'DISPATCHED'],
    required: false,
  },
  scannedInAt: {
    type: 'datetime',
    required: false,
    note: 'Thời gian quét mã khi nhập kho',
  },
  scannedInBy: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Nhân viên quét mã nhập',
  },
  scannedOutAt: {
    type: 'datetime',
    required: false,
    note: 'Thời gian quét mã khi xuất kho',
  },
  scannedOutBy: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Nhân viên quét mã xuất',
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

export const tableName = 'qr_tags';

export default qrTagSchema;
