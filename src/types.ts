export type UserRole = 'worker' | 'picker' | 'counter' | 'inventory' | 'lead' | 'admin' | 'platformOwner';
export type ParsedQrType = 'location' | 'item_label' | 'item_number' | 'unknown';
export type ScanSource = 'camera' | 'manual' | 'upload' | 'system';
export type PickLineStatus = 'Queued' | 'Verified' | 'Needs Review' | 'Override Approved' | 'Picked' | 'Short';
export type InventoryStatus =
  | 'Pending'
  | '✅ Sent to Inventory'
  | '⚠️ Needs Recheck'
  | '✅ Pulled'
  | '⚠️ Partially Pulled'
  | '❌ Issue / Needs Review'
  | '✔️ Resolved'
  | 'Short';

export interface ActorIdentity {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserProfile extends ActorIdentity {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface ItemLabelPayload {
  type: 'item_label';
  item: string;
  description: string;
  location: string;
  uom: string;
  source: string;
  qty?: number;
}

export interface ParsedQrScan {
  parsedType: ParsedQrType;
  rawValue: string;
  item: string;
  location: string;
  description: string;
  uom: string;
  source: string;
  qty: number;
  payload: ItemLabelPayload | null;
}

export interface ReceivingLabelDraft {
  lineId: string;
  docType: string;
  docNumber: string;
  branch: string;
  item: string;
  qty: number;
  description: string;
  location: string;
  uom: string;
  sourceFile: string;
  qrPayload: ItemLabelPayload;
}

export interface ReceivingLabelRecord extends ReceivingLabelDraft {
  id: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface LocationLabelRecord {
  id: string;
  location: string;
  qrValue: string;
  aisle: string;
  bay: string;
  level: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface ItemMasterImportRow {
  rowNumber: number;
  item: string;
  description: string;
  vendorDescription: string;
  availableQty: number;
  defaultLocation: string;
  binLocation: string;
  uom: string;
  category: string;
  itemType: string;
  websiteUrl: string;
  qrPayload: ItemLabelPayload;
  sourceFile: string;
  active: boolean;
}

export interface ItemMasterRecord extends ItemMasterImportRow {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy: string;
  updatedByEmail: string;
}

export interface PutAwayLine {
  id: string;
  lineNumber: number;
  item: string;
  description: string;
  qty: number;
  location: string;
  notes: string;
  scannedItemRaw: string;
  scannedLocationRaw: string;
}

export interface PutAwaySession {
  id: string;
  worker: string;
  date: string;
  docNumber: string;
  receivedTime: string;
  stockedTime: string;
  dockToStockMinutes: number;
  lines: PutAwayLine[];
  lineCount: number;
  totalQty: number;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface CycleCountLine {
  id: string;
  lineNumber: number;
  item: string;
  description: string;
  location: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  reason: string;
  warning: string;
  done: boolean;
}

export interface CycleCountSession {
  id: string;
  counter: string;
  date: string;
  countId: string;
  activeLocation: string;
  lines: CycleCountLine[];
  lineCount: number;
  varianceLines: number;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface PickTicketLine {
  id: string;
  pickTicketId: string;
  orderNumber: string;
  lineNumber: string;
  expectedItem: string;
  expectedDescription: string;
  fromSlot: string;
  requiredQty: number;
  availableQty: number;
  pickedQty: number;
  remainingQty: number;
  uom: string;
  scannedItem: string;
  scannedLocation: string;
  itemMasterDescription: string;
  itemStatus: string;
  locationStatus: string;
  verifyResult: string;
  status: PickLineStatus;
  pullCheck: boolean;
  inventoryStatus: InventoryStatus;
  overrideNotes: string;
  overrideBy: string;
  overrideByEmail: string;
  lastVerifiedAt?: string;
  lastPullQty: number;
}

export interface OrderPickingSession {
  id: string;
  picker: string;
  date: string;
  orderNumber: string;
  lines: PickTicketLine[];
  lineCount: number;
  totalPicked: number;
  issueLines: number;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface ScanVerificationRecord {
  id: string;
  documentNumber: string;
  pickTicketId: string;
  lineId: string;
  expectedItem: string;
  expectedLocation: string;
  scannedItem: string;
  scannedLocation: string;
  itemMasterDescription: string;
  itemStatus: string;
  locationStatus: string;
  overallResult: string;
  notes: string;
  overrideUsed: boolean;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface PullConfirmationRecord {
  id: string;
  documentNumber: string;
  pickTicketId: string;
  lineId: string;
  item: string;
  description: string;
  location: string;
  pickedQty: number;
  inventoryStatus: InventoryStatus;
  active: boolean;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy: string;
  createdByEmail: string;
  updatedBy: string;
  updatedByEmail: string;
}

export interface QrScanRecord {
  id: string;
  rawValue: string;
  parsedType: ParsedQrType;
  item: string;
  location: string;
  description: string;
  qty: number;
  sourceModule: string;
  documentNumber: string;
  sessionId: string;
  expectedItem: string;
  expectedLocation: string;
  result: string;
  scanSource: ScanSource;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface ActivityLogRecord {
  id: string;
  type: string;
  employee: string;
  date: string;
  item: string;
  description: string;
  qty: number;
  systemQty: number;
  countedQty: number;
  requiredQty: number;
  pickedQty: number;
  remainingQty: number;
  availableQty: number;
  variance: number;
  location: string;
  uom: string;
  documentNumber: string;
  receivedTime: string;
  stockedTime: string;
  dockToStockMinutes: number;
  status: string;
  reason: string;
  notes: string;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}

export interface InventoryItemSignals {
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
}
