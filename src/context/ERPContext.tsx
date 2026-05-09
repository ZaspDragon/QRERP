import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { demoPayloadPresets, demoState } from '../data/demoData';
import type { AppState, Employee, EntitySummary, QRPayload, ScanRecord, ScanSource, SettingsState } from '../types';
import { formatDateTime } from '../utils/format';
import { printLabel } from '../utils/printing';
import { createId, getReadableType, getRouteActionLabel, getWorkflowName, parseScanValue, stringifyPayload } from '../utils/qr';
import QRCode from 'qrcode';

const STORAGE_KEY = 'qr-legends-erp-demo-state';

interface ERPContextValue extends AppState {
  currentUser: Employee;
  activeScan: ScanRecord | null;
  payloadPresets: QRPayload[];
  scanQr: (rawValue: string, source?: ScanSource) => ScanRecord;
  startTaskForScan: (scanId: string) => void;
  completeTaskForScan: (scanId: string) => void;
  reportIssueForScan: (scanId: string, notes: string) => void;
  addNotesToScan: (scanId: string, notes: string) => void;
  setActiveScan: (scanId: string | null) => void;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetDemoData: () => void;
  getEntitySummary: (scanId?: string | null) => EntitySummary | null;
  getLabelPreview: (scanId: string) => Promise<{ title: string; qrImage: string; payloadText: string; details: string[] } | null>;
}

const ERPContext = createContext<ERPContextValue | null>(null);

function cloneState(state: AppState) {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function readInitialState() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return cloneState(demoState);
  }

  try {
    return JSON.parse(stored) as AppState;
  } catch {
    return cloneState(demoState);
  }
}

function matchesIdentifier(scan: ScanRecord, ...candidates: Array<string | undefined>) {
  const normalizedCandidates = candidates.filter(Boolean).map((value) => value?.toUpperCase());
  const entityId = scan.entityId.toUpperCase();
  const displayValue = scan.displayValue.toUpperCase();
  const code = scan.payload?.code.toUpperCase();
  return normalizedCandidates.some((candidate) => candidate === entityId || candidate === displayValue || candidate === code);
}

function getCurrentUser(state: AppState) {
  return state.employees.find((employee) => employee.id === state.settings.activeUserId) ?? state.employees[0];
}

function getScanById(state: AppState, scanId: string | null | undefined) {
  return state.scanHistory.find((scan) => scan.id === scanId) ?? null;
}

function resolveEntitySummary(state: AppState, scan: ScanRecord | null): EntitySummary | null {
  if (!scan) {
    return null;
  }

  switch (scan.qrType) {
    case 'ITEM': {
      const item = state.items.find((entry) => matchesIdentifier(scan, entry.id, entry.sku));
      return item
        ? {
            title: item.name,
            subtitle: item.sku,
            status: item.status,
            details: [
              { label: 'Item ID', value: item.id },
              { label: 'Bin', value: item.binId },
              { label: 'Pallet', value: item.palletId },
              { label: 'On Hand', value: `${item.quantity}` },
            ],
          }
        : null;
    }
    case 'BIN': {
      const bin = state.bins.find((entry) => matchesIdentifier(scan, entry.id));
      return bin
        ? {
            title: bin.id,
            subtitle: `Zone ${bin.zone}`,
            status: bin.status,
            details: [
              { label: 'Aisle', value: bin.aisle },
              { label: 'Level', value: bin.level },
              { label: 'Occupancy', value: `${bin.occupancy}%` },
              { label: 'Capacity', value: `${bin.capacity}%` },
            ],
          }
        : null;
    }
    case 'PALLET': {
      const pallet = state.pallets.find((entry) => matchesIdentifier(scan, entry.id));
      return pallet
        ? {
            title: pallet.id,
            subtitle: `Pallet in ${pallet.currentBinId}`,
            status: pallet.status,
            details: [
              { label: 'Items', value: `${pallet.itemCount}` },
              { label: 'Location', value: pallet.currentBinId },
              { label: 'Last Move', value: formatDateTime(pallet.lastMove) },
              { label: 'Scan Type', value: getReadableType(scan.qrType) },
            ],
          }
        : null;
    }
    case 'RECEIVING':
    case 'OSD': {
      const load = state.receivingLoads.find((entry) => matchesIdentifier(scan, entry.id, entry.palletId));
      return load
        ? {
            title: load.id,
            subtitle: load.supplier,
            status: load.status,
            details: [
              { label: 'Dock', value: load.dock },
              { label: 'ETA', value: formatDateTime(load.eta) },
              { label: 'Pallet', value: load.palletId },
              { label: 'Units', value: `${load.itemCount}` },
            ],
          }
        : {
            title: scan.displayValue,
            subtitle: 'Receiving exception',
            status: 'Needs Review',
            details: [
              { label: 'Type', value: getReadableType(scan.qrType) },
              { label: 'Entity', value: scan.entityId },
              { label: 'Workflow', value: getWorkflowName(scan.qrType) },
              { label: 'Status', value: scan.status },
            ],
          };
    }
    case 'PUTAWAY': {
      const task = state.putawayTasks.find((entry) => matchesIdentifier(scan, entry.id, entry.palletId));
      return task
        ? {
            title: task.id,
            subtitle: `${task.fromDock} to ${task.toBin}`,
            status: task.status,
            details: [
              { label: 'Pallet', value: task.palletId },
              { label: 'Priority', value: task.priority },
              { label: 'Assignee', value: task.assignee },
              { label: 'Destination', value: task.toBin },
            ],
          }
        : null;
    }
    case 'CYCLE_COUNT': {
      const task = state.cycleCounts.find((entry) => matchesIdentifier(scan, entry.id, entry.zone));
      return task
        ? {
            title: task.id,
            subtitle: task.zone,
            status: task.status,
            details: [
              { label: 'Scheduled', value: formatDateTime(task.scheduledFor) },
              { label: 'Variance', value: `${task.variance}` },
              { label: 'Assignee', value: task.assignee },
              { label: 'Workflow', value: getWorkflowName(scan.qrType) },
            ],
          }
        : null;
    }
    case 'ORDER_PICK':
    case 'TRANSFER_PICK': {
      const task = state.orderPicks.find((entry) => matchesIdentifier(scan, entry.id, entry.orderId));
      return task
        ? {
            title: task.id,
            subtitle: `${task.mode} - ${task.orderId}`,
            status: task.status,
            details: [
              { label: 'Route', value: task.route },
              { label: 'Lines', value: `${task.lines}` },
              { label: 'Priority', value: task.priority },
              { label: 'Assignee', value: task.assignee },
            ],
          }
        : null;
    }
    case 'EMPLOYEE': {
      const employee = state.employees.find((entry) => matchesIdentifier(scan, entry.id, entry.name));
      return employee
        ? {
            title: employee.name,
            subtitle: employee.id,
            status: employee.status,
            details: [
              { label: 'Role', value: employee.role },
              { label: 'Shift', value: employee.shift },
              { label: 'Certifications', value: employee.certifications.join(', ') },
              { label: 'Workflow', value: getWorkflowName(scan.qrType) },
            ],
          }
        : null;
    }
    case 'EQUIPMENT': {
      const equipment = state.equipment.find((entry) => matchesIdentifier(scan, entry.id, entry.name));
      return equipment
        ? {
            title: equipment.name,
            subtitle: equipment.id,
            status: equipment.status,
            details: [
              { label: 'Type', value: equipment.type },
              { label: 'Battery', value: equipment.battery },
              { label: 'Location', value: equipment.location },
              { label: 'Assigned', value: equipment.assignedTo },
            ],
          }
        : null;
    }
    case 'SAFETY': {
      const report = state.safetyReports.find((entry) => matchesIdentifier(scan, entry.id, entry.area));
      return report
        ? {
            title: report.title,
            subtitle: report.id,
            status: report.status,
            details: [
              { label: 'Area', value: report.area },
              { label: 'Severity', value: report.severity },
              { label: 'Owner', value: report.owner },
              { label: 'Updated', value: formatDateTime(report.updatedAt) },
            ],
          }
        : null;
    }
    case 'UNKNOWN':
    default:
      return {
        title: scan.displayValue,
        subtitle: 'Unknown QR payload',
        status: scan.status,
        details: [
          { label: 'Type', value: getReadableType(scan.qrType) },
          { label: 'Entity', value: scan.entityId },
          { label: 'Workflow', value: getWorkflowName(scan.qrType) },
          { label: 'Source', value: scan.source },
        ],
      };
  }
}

function appendHistoryEvent(baseState: AppState, sourceScan: ScanRecord, currentUser: Employee, action: string, status: string, notes?: string) {
  const event: ScanRecord = {
    id: createId('scan'),
    timestamp: new Date().toISOString(),
    qrType: sourceScan.qrType,
    rawValue: sourceScan.rawValue,
    displayValue: sourceScan.displayValue,
    action,
    status,
    user: currentUser.name,
    source: sourceScan.source,
    workflowRoute: sourceScan.workflowRoute,
    entityId: sourceScan.entityId,
    payload: sourceScan.payload,
    notes,
  };

  return {
    ...baseState,
    activeScanId: event.id,
    scanHistory: [event, ...baseState.scanHistory],
  };
}

function updateEntityStatus(state: AppState, scan: ScanRecord, mode: 'start' | 'complete' | 'issue') {
  const nextState = cloneState(state);

  switch (scan.qrType) {
    case 'RECEIVING':
    case 'OSD':
      nextState.receivingLoads = nextState.receivingLoads.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.palletId)
          ? { ...entry, status: mode === 'complete' ? 'Received' : mode === 'issue' ? 'Blocked' : 'In Progress' }
          : entry,
      );
      break;
    case 'PUTAWAY':
      nextState.putawayTasks = nextState.putawayTasks.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.palletId)
          ? { ...entry, status: mode === 'complete' ? 'Complete' : mode === 'issue' ? 'Blocked' : 'In Progress' }
          : entry,
      );
      break;
    case 'CYCLE_COUNT':
      nextState.cycleCounts = nextState.cycleCounts.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.zone)
          ? { ...entry, status: mode === 'complete' ? 'Counted' : mode === 'issue' ? 'Investigate' : 'In Progress' }
          : entry,
      );
      break;
    case 'ORDER_PICK':
    case 'TRANSFER_PICK':
      nextState.orderPicks = nextState.orderPicks.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.orderId)
          ? { ...entry, status: mode === 'complete' ? 'Picked' : mode === 'issue' ? 'Blocked' : 'In Progress' }
          : entry,
      );
      break;
    case 'EQUIPMENT':
      nextState.equipment = nextState.equipment.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.name)
          ? { ...entry, status: mode === 'complete' ? 'Ready' : mode === 'issue' ? 'Inspection' : 'In Use' }
          : entry,
      );
      break;
    case 'SAFETY':
      nextState.safetyReports = nextState.safetyReports.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.area)
          ? { ...entry, status: mode === 'complete' ? 'Resolved' : mode === 'issue' ? 'Escalated' : 'Mitigation', updatedAt: new Date().toISOString() }
          : entry,
      );
      break;
    case 'ITEM':
      nextState.items = nextState.items.map((entry) =>
        matchesIdentifier(scan, entry.id, entry.sku)
          ? { ...entry, status: mode === 'issue' ? 'Hold' : 'Active', lastScan: new Date().toISOString() }
          : entry,
      );
      break;
    case 'BIN':
      nextState.bins = nextState.bins.map((entry) =>
        matchesIdentifier(scan, entry.id)
          ? { ...entry, status: mode === 'issue' ? 'Audit Needed' : 'Open' }
          : entry,
      );
      break;
    case 'PALLET':
      nextState.pallets = nextState.pallets.map((entry) =>
        matchesIdentifier(scan, entry.id)
          ? { ...entry, status: mode === 'complete' ? 'Verified' : mode === 'issue' ? 'Hold' : 'In Motion', lastMove: new Date().toISOString() }
          : entry,
      );
      break;
    default:
      break;
  }

  return nextState;
}

export function ERPProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(() => readInitialState());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentUser = getCurrentUser(state);
  const activeScan = getScanById(state, state.activeScanId);

  function scanQr(rawValue: string, source: ScanSource = 'manual') {
    const parsed = parseScanValue(rawValue);
    const record: ScanRecord = {
      id: createId('scan'),
      timestamp: new Date().toISOString(),
      qrType: parsed.qrType,
      rawValue: parsed.rawValue,
      displayValue: parsed.displayValue,
      action: getRouteActionLabel(parsed.qrType),
      status: parsed.qrType === 'UNKNOWN' ? 'Needs Review' : 'Ready',
      user: currentUser.name,
      source,
      workflowRoute: parsed.workflowRoute,
      entityId: parsed.entityId,
      payload: parsed.payload,
    };

    setState((previous) => ({
      ...previous,
      activeScanId: record.id,
      scanHistory: [record, ...previous.scanHistory],
    }));

    return record;
  }

  function setActiveScan(scanId: string | null) {
    setState((previous) => ({
      ...previous,
      activeScanId: scanId,
    }));
  }

  function startTaskForScan(scanId: string) {
    setState((previous) => {
      const sourceScan = getScanById(previous, scanId);
      if (!sourceScan) {
        return previous;
      }

      const nextState = updateEntityStatus(previous, sourceScan, 'start');
      return appendHistoryEvent(nextState, sourceScan, getCurrentUser(previous), 'Task Started', 'In Progress');
    });
  }

  function completeTaskForScan(scanId: string) {
    setState((previous) => {
      const sourceScan = getScanById(previous, scanId);
      if (!sourceScan) {
        return previous;
      }

      const nextState = updateEntityStatus(previous, sourceScan, 'complete');
      return appendHistoryEvent(nextState, sourceScan, getCurrentUser(previous), 'Task Completed', 'Complete');
    });
  }

  function reportIssueForScan(scanId: string, notes: string) {
    setState((previous) => {
      const sourceScan = getScanById(previous, scanId);
      if (!sourceScan) {
        return previous;
      }

      const nextState = updateEntityStatus(previous, sourceScan, 'issue');
      return appendHistoryEvent(nextState, sourceScan, getCurrentUser(previous), 'Issue Logged', 'Issue Reported', notes);
    });
  }

  function addNotesToScan(scanId: string, notes: string) {
    setState((previous) => {
      const sourceScan = getScanById(previous, scanId);
      if (!sourceScan) {
        return previous;
      }

      return appendHistoryEvent(previous, sourceScan, getCurrentUser(previous), 'Notes Added', 'Logged', notes);
    });
  }

  function updateSetting<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setState((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        [key]: value,
      },
    }));
  }

  function resetDemoData() {
    setState(cloneState(demoState));
  }

  function getEntitySummary(scanId?: string | null) {
    return resolveEntitySummary(state, getScanById(state, scanId ?? state.activeScanId));
  }

  async function getLabelPreview(scanId: string) {
    const sourceScan = getScanById(state, scanId);
    if (!sourceScan) {
      return null;
    }

    const summary = resolveEntitySummary(state, sourceScan);
    const payload =
      sourceScan.payload ??
      {
        type: sourceScan.qrType,
        entityId: sourceScan.entityId,
        code: sourceScan.entityId,
        label: summary?.title ?? sourceScan.displayValue,
        workflow: getWorkflowName(sourceScan.qrType),
        site: state.settings.siteName,
        createdAt: sourceScan.timestamp,
        metadata: {
          source: sourceScan.source,
          user: sourceScan.user,
        },
      };
    const payloadText = stringifyPayload(payload);
    const qrImage = await QRCode.toDataURL(payloadText, { width: 280, margin: 1 });
    return {
      title: summary?.title ?? sourceScan.displayValue,
      qrImage,
      payloadText,
      details: [
        `Type: ${getReadableType(sourceScan.qrType)}`,
        `Entity: ${sourceScan.entityId}`,
        `Action: ${sourceScan.action}`,
        `User: ${sourceScan.user}`,
      ],
    };
  }

  const value: ERPContextValue = {
    ...state,
    currentUser,
    activeScan,
    payloadPresets: demoPayloadPresets,
    scanQr,
    startTaskForScan,
    completeTaskForScan,
    reportIssueForScan,
    addNotesToScan,
    setActiveScan,
    updateSetting,
    resetDemoData,
    getEntitySummary,
    getLabelPreview,
  };

  return <ERPContext.Provider value={value}>{children}</ERPContext.Provider>;
}

export function useERP() {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used inside ERPProvider.');
  }

  return context;
}

export async function printScanLabel(getLabelPreview: ERPContextValue['getLabelPreview'], scanId: string) {
  const label = await getLabelPreview(scanId);
  if (!label) {
    return;
  }

  printLabel(label.title, label.qrImage, label.payloadText, label.details);
}
