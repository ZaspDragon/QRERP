export const qrTypes = [
  'ITEM',
  'BIN',
  'PALLET',
  'RECEIVING',
  'PUTAWAY',
  'CYCLE_COUNT',
  'ORDER_PICK',
  'TRANSFER_PICK',
  'EMPLOYEE',
  'EQUIPMENT',
  'SAFETY',
  'OSD',
  'UNKNOWN',
] as const;

export type QRType = (typeof qrTypes)[number];
export type ScanSource = 'camera' | 'manual' | 'demo' | 'generator';
export type AccessLevel = 'picker' | 'lead' | 'admin' | 'inventory';
export type PickLineStatus = 'Queued' | 'Verified' | 'Needs Review' | 'Override Approved' | 'Picked' | 'Short';
export type InventoryStatus = 'Pending' | 'Needs Review' | 'Short' | '✅ Sent to Inventory';

export interface QRPayload {
  type: QRType;
  entityId: string;
  code: string;
  label: string;
  workflow: string;
  site: string;
  createdAt: string;
  metadata: Record<string, string>;
}

export interface ParsedScan {
  qrType: QRType;
  rawValue: string;
  displayValue: string;
  entityId: string;
  code: string;
  workflowRoute: string;
  payload: QRPayload | null;
}

export interface ScanRecord {
  id: string;
  timestamp: string;
  qrType: QRType;
  rawValue: string;
  displayValue: string;
  action: string;
  status: string;
  user: string;
  source: ScanSource;
  workflowRoute: string;
  entityId: string;
  payload: QRPayload | null;
  notes?: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  binId: string;
  palletId: string;
  status: string;
  reorderPoint: number;
  lastScan: string;
}

export interface Bin {
  id: string;
  zone: string;
  aisle: string;
  level: string;
  occupancy: number;
  capacity: number;
  status: string;
}

export interface Pallet {
  id: string;
  itemCount: number;
  currentBinId: string;
  status: string;
  lastMove: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: AccessLevel;
  shift: string;
  certifications: string[];
  status: string;
}

export interface ReceivingLoad {
  id: string;
  supplier: string;
  dock: string;
  eta: string;
  status: string;
  palletId: string;
  itemCount: number;
}

export interface PutawayTask {
  id: string;
  fromDock: string;
  toBin: string;
  palletId: string;
  priority: string;
  status: string;
  assignee: string;
}

export interface CycleCountTask {
  id: string;
  zone: string;
  scheduledFor: string;
  variance: number;
  status: string;
  assignee: string;
}

export interface OrderPickTask {
  id: string;
  orderId: string;
  route: string;
  lines: number;
  priority: string;
  status: string;
  assignee: string;
  mode: 'Order Pick' | 'Transfer Pick';
}

export interface Shipment {
  id: string;
  carrier: string;
  dock: string;
  orders: number;
  trailer: string;
  departure: string;
  status: string;
}

export interface SafetyReport {
  id: string;
  title: string;
  area: string;
  severity: string;
  owner: string;
  status: string;
  updatedAt: string;
}

export interface EquipmentRecord {
  id: string;
  name: string;
  type: string;
  battery: string;
  status: string;
  location: string;
  assignedTo: string;
}

export interface SettingsState {
  siteName: string;
  activeUserId: string;
  handheldMode: boolean;
  autoPrintLabels: boolean;
}

export interface AppState {
  items: Item[];
  bins: Bin[];
  pallets: Pallet[];
  employees: Employee[];
  receivingLoads: ReceivingLoad[];
  putawayTasks: PutawayTask[];
  cycleCounts: CycleCountTask[];
  orderPicks: OrderPickTask[];
  shipments: Shipment[];
  safetyReports: SafetyReport[];
  equipment: EquipmentRecord[];
  scanHistory: ScanRecord[];
  activeScanId: string | null;
  settings: SettingsState;
}

export interface DetailRow {
  label: string;
  value: string;
}

export interface EntitySummary {
  title: string;
  subtitle: string;
  status: string;
  details: DetailRow[];
}

export interface ItemLabelPayload {
  type: 'item_label';
  item: string;
  description: string;
  location: string;
  uom: string;
  source: string;
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

export interface PickTicketLine {
  id: string;
  pickTicketId: string;
  orderNumber: string;
  lineNumber: string;
  expectedItem: string;
  expectedDescription: string;
  fromSlot: string;
  quantity: number;
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
}

export interface ScanVerificationRecord {
  id: string;
  pickTicketId: string;
  lineId: string;
  orderNumber: string;
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
  pickTicketId: string;
  lineId: string;
  orderNumber: string;
  item: string;
  description: string;
  location: string;
  inventoryStatus: InventoryStatus;
  active: boolean;
  notes: string;
  createdAt?: string;
  createdBy: string;
  createdByEmail: string;
}
