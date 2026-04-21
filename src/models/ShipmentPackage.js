/**
 * ShipmentPackage Schema - Don vi hang hoa vat ly (thung/cuc/pallet)
 * Moi package co ma scan rieng (Code 128/QR) de theo doi nhap xuat kho.
 */
export const shipmentPackageSchema = {
  packageId: {
    type: 'string',
    primaryKey: true,
  },
  shipmentId: {
    type: 'string',
    required: true,
    foreignKey: 'shipment_id',
    note: 'ref Shipment.shipment_id - Chuyen hang chua package nay',
  },
  importExportRecordId: {
    type: 'string',
    required: false,
    foreignKey: 'record_id',
    note: 'ref ImportExportRecord.record_id - Phieu nhap/xuat lien quan',
  },
  slotId: {
    type: 'string',
    required: false,
    foreignKey: 'slot_id',
    note: 'ref Slot.slot_id - Vi tri luu tru package',
  },
  packageCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
    note: 'Ma dinh danh nghiep vu cho package (in tren nhan)',
  },
  codeValue: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 255,
    note: 'Gia tri ma scan (du lieu in ra Code128/QR)',
  },
  codeType: {
    type: 'enum',
    enum: ['CODE128', 'QRCODE'],
    required: true,
    default: 'CODE128',
    note: 'Loai ma scan de mo rong tuong lai',
  },
  quantity: {
    type: 'number',
    required: false,
    note: 'So luong hang ben trong package',
  },
  weight: {
    type: 'number',
    required: false,
    note: 'Trong luong package (kg)',
  },
  volume: {
    type: 'number',
    required: false,
    note: 'The tich package (m3)',
  },
  productDetails: {
    type: 'text',
    required: false,
    note: 'Mo ta chi tiet hang hoa trong package',
  },
  status: {
    type: 'enum',
    enum: ['CREATED', 'IN_TRANSIT', 'STORED', 'DISPATCHED', 'CANCELLED'],
    required: true,
    default: 'CREATED',
    note: 'Trang thai vong doi package',
  },
  printedAt: {
    type: 'datetime',
    required: false,
    note: 'Thoi diem in ma scan',
  },
  scannedInAt: {
    type: 'datetime',
    required: false,
    note: 'Thoi diem quet nhap kho',
  },
  scannedInBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Nhan vien quet nhap',
  },
  scannedOutAt: {
    type: 'datetime',
    required: false,
    note: 'Thoi diem quet xuat kho',
  },
  scannedOutBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Nhan vien quet xuat',
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

export const indexes = [
  'shipment_id',
  'import_export_record_id',
  'slot_id',
  'package_code',
  'code_value',
  'status',
];

export const tableName = 'shipment_packages';

export default shipmentPackageSchema;
