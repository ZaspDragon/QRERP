import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import CameraScanner from '../components/qr/CameraScanner';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { getItemMasterRecord } from '../lib/item-master';
import { canMarkPicked, getInventoryStatusForFailure, getStatusAfterVerification, parsePickScan, parsePickTicketFile, verifyPickScan } from '../lib/pick-ticket';
import { getFirebaseConfigError, isFirebaseConfigured } from '../lib/firebase';
import { savePullConfirmation, saveScanVerification } from '../lib/verification-store';
import { formatDateTime } from '../utils/format';
import type { PickTicketLine } from '../types';

const STORAGE_KEY = 'qr-legends-erp-pick-ticket-lines';

function readStoredLines() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return [] as PickTicketLine[];
  }

  try {
    return JSON.parse(stored) as PickTicketLine[];
  } catch {
    return [] as PickTicketLine[];
  }
}

export default function OrderPickingPage() {
  const { currentUser, orderPicks } = useERP();
  const firebaseReady = isFirebaseConfigured();
  const firebaseError = getFirebaseConfigError();

  const [pickTicketLines, setPickTicketLines] = useState<PickTicketLine[]>(() => readStoredLines());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(() => readStoredLines()[0]?.id ?? null);
  const [manualScan, setManualScan] = useState('');
  const [pageStatus, setPageStatus] = useState('');
  const [pageError, setPageError] = useState('');
  const [headerSummary, setHeaderSummary] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const selectedLine = useMemo(
    () => pickTicketLines.find((line) => line.id === selectedLineId) ?? null,
    [pickTicketLines, selectedLineId],
  );

  const pickedLines = pickTicketLines.filter((line) => line.status === 'Picked').length;
  const needsReviewLines = pickTicketLines.filter((line) => ['Needs Review', 'Short'].includes(line.status)).length;
  const verifiedLines = pickTicketLines.filter((line) => ['Verified', 'Override Approved', 'Picked'].includes(line.status)).length;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pickTicketLines));
  }, [pickTicketLines]);

  useEffect(() => {
    if (!selectedLineId && pickTicketLines.length) {
      setSelectedLineId(pickTicketLines[0].id);
    }

    if (selectedLineId && !pickTicketLines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(pickTicketLines[0]?.id ?? null);
    }
  }, [pickTicketLines, selectedLineId]);

  function updateLine(lineId: string, updater: (line: PickTicketLine) => PickTicketLine) {
    setPickTicketLines((previous) =>
      previous.map((line) => (line.id === lineId ? updater(line) : line)),
    );
  }

  async function recordVerification(line: PickTicketLine, overrides?: Partial<Parameters<typeof saveScanVerification>[0]>) {
    if (!firebaseReady) {
      return;
    }

    await saveScanVerification({
      pickTicketId: line.pickTicketId,
      lineId: line.id,
      orderNumber: line.orderNumber,
      expectedItem: line.expectedItem,
      expectedLocation: line.fromSlot,
      scannedItem: line.scannedItem,
      scannedLocation: line.scannedLocation,
      itemMasterDescription: line.itemMasterDescription,
      itemStatus: line.itemStatus,
      locationStatus: line.locationStatus,
      overallResult: line.status,
      notes: line.overrideNotes,
      overrideUsed: Boolean(line.overrideBy),
      createdBy: currentUser.name,
      createdByEmail: currentUser.email,
      ...overrides,
    });
  }

  async function handlePickTicketUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPageStatus('');
    setPageError('');

    try {
      const parsed = await parsePickTicketFile(file);
      setPickTicketLines(parsed.rows);
      setSelectedLineId(parsed.rows[0]?.id ?? null);
      setHeaderSummary(
        `Header row ${parsed.headerRowIndex + 1} detected from ${parsed.sheetName}. ${Object.entries(parsed.detectedHeaders)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ')}`,
      );
      setPageStatus(`Loaded ${parsed.rows.length} pick ticket lines from ${parsed.fileName}.`);
      setManualScan('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to parse the uploaded pick ticket.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleVerifyScan(rawValue: string) {
    if (!selectedLine) {
      setPageError('Select a pick ticket line before scanning.');
      return;
    }

    const parsedScan = parsePickScan(rawValue);

    if (!parsedScan.scannedItem) {
      setPageError('The scanned value did not contain an item number.');
      return;
    }

    setIsWorking(true);
    setPageStatus('');
    setPageError('');

    try {
      let itemMaster = null;

      try {
        itemMaster = await getItemMasterRecord(parsedScan.scannedItem);
      } catch {
        itemMaster = null;
      }

      const outcome = verifyPickScan(selectedLine, parsedScan, itemMaster);
      const nextLine: PickTicketLine = {
        ...selectedLine,
        scannedItem: parsedScan.scannedItem,
        scannedLocation: parsedScan.scannedLocation,
        itemMasterDescription: outcome.itemMasterDescription,
        itemStatus: outcome.itemStatus,
        locationStatus: outcome.locationStatus,
        verifyResult: outcome.verifyResult,
        status: getStatusAfterVerification(outcome),
        inventoryStatus: getInventoryStatusForFailure(outcome),
        lastVerifiedAt: new Date().toISOString(),
      };

      updateLine(selectedLine.id, () => nextLine);
      await recordVerification(nextLine, { overallResult: outcome.overallResult, notes: selectedLine.overrideNotes });
      setPageStatus(outcome.verifyResult);
      setManualScan('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to verify the scanned item.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleApplyOverride() {
    if (!selectedLine) {
      return;
    }

    if (!['lead', 'admin'].includes(currentUser.accessLevel)) {
      setPageError('Only a lead or admin can apply an override.');
      return;
    }

    if (!selectedLine.overrideNotes.trim()) {
      setPageError('Override notes are required before applying a lead/admin override.');
      return;
    }

    const nextLine: PickTicketLine = {
      ...selectedLine,
      status: 'Override Approved',
      inventoryStatus: 'Needs Review',
      overrideBy: currentUser.name,
      overrideByEmail: currentUser.email,
    };

    updateLine(selectedLine.id, () => nextLine);

    try {
      await recordVerification(nextLine, { overallResult: 'Override Approved', notes: nextLine.overrideNotes, overrideUsed: true });
      setPageStatus(`Override approved by ${currentUser.name}.`);
      setPageError('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to record the override.');
    }
  }

  function handleMarkPicked() {
    if (!selectedLine) {
      return;
    }

    if (!canMarkPicked(selectedLine)) {
      setPageError('This line cannot be marked Picked until the scanned item matches or a lead/admin override is recorded.');
      return;
    }

    updateLine(selectedLine.id, (line) => ({
      ...line,
      status: 'Picked',
    }));
    setPageStatus(`Line ${selectedLine.lineNumber} is now marked Picked.`);
    setPageError('');
  }

  async function handleCheckPull() {
    if (!selectedLine) {
      return;
    }

    if (selectedLine.status !== 'Picked') {
      setPageError('Mark the line Picked before sending the pull to inventory.');
      return;
    }

    setIsWorking(true);
    setPageStatus('');
    setPageError('');

    const nextLine: PickTicketLine = {
      ...selectedLine,
      pullCheck: true,
      inventoryStatus: '✅ Sent to Inventory',
    };

    try {
      if (firebaseReady) {
        await savePullConfirmation({
          pickTicketId: nextLine.pickTicketId,
          lineId: nextLine.id,
          orderNumber: nextLine.orderNumber,
          item: nextLine.expectedItem,
          description: nextLine.itemMasterDescription || nextLine.expectedDescription,
          location: nextLine.scannedLocation || nextLine.fromSlot,
          inventoryStatus: '✅ Sent to Inventory',
          active: true,
          notes: nextLine.overrideNotes,
          createdBy: currentUser.name,
          createdByEmail: currentUser.email,
        });
      }

      updateLine(selectedLine.id, () => nextLine);
      setPageStatus(`Pull confirmation saved for item ${nextLine.expectedItem}.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to save the pull confirmation.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMarkShort() {
    if (!selectedLine) {
      return;
    }

    const nextLine: PickTicketLine = {
      ...selectedLine,
      status: 'Short',
      inventoryStatus: 'Short',
    };

    updateLine(selectedLine.id, () => nextLine);

    try {
      await recordVerification(nextLine, { overallResult: 'Short', notes: nextLine.overrideNotes || 'Marked short during pull verification.' });
      setPageStatus(`Line ${nextLine.lineNumber} marked Short.`);
      setPageError('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to record the short status.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Outbound Work"
        title="Order picking"
        description="Upload pick ticket lines, verify item-label QR scans against Firestore itemMaster, block Picked status unless the item matches or a lead/admin override is documented, and send confirmed pulls to inventory."
      />

      <RouteWorkflowCard route="/order-picking" />

      {!firebaseReady ? <div className="info-banner warning-banner">{firebaseError}</div> : null}

      <section className="stat-grid">
        <StatCard label="Queued Waves" value={`${orderPicks.filter((task) => task.status === 'Queued').length}`} helper="Existing work queue ready for release" />
        <StatCard label="Uploaded Lines" value={`${pickTicketLines.length}`} helper="Rows loaded from the current pick ticket" />
        <StatCard label="Verified Lines" value={`${verifiedLines}`} helper="Item matched or override approved" />
        <StatCard label="Picked Lines" value={`${pickedLines}`} helper={`${needsReviewLines} line(s) still need review`} />
      </section>

      <SectionCard title="Pick Ticket Upload" description="Upload an Excel or CSV pick ticket. The expected item number on each row becomes the verification target.">
        <div className="stack-form">
          <label>
            <span>Upload pick ticket</span>
            <input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={handlePickTicketUpload} />
          </label>
          {headerSummary ? <div className="code-block">{headerSummary}</div> : null}
          {pageStatus ? <div className="info-banner success-banner">{pageStatus}</div> : null}
          {pageError ? <div className="info-banner danger-banner">{pageError}</div> : null}
        </div>
      </SectionCard>

      <div className="split-layout">
        <SectionCard title="Selected Line Verification" description="Scan the item label or paste the raw QR payload for the currently selected pick line.">
          {selectedLine ? (
            <div className="stack-form">
              <div className="detail-grid">
                <div>
                  <dt>Order</dt>
                  <dd>{selectedLine.orderNumber}</dd>
                </div>
                <div>
                  <dt>Line</dt>
                  <dd>{selectedLine.lineNumber}</dd>
                </div>
                <div>
                  <dt>Expected Item</dt>
                  <dd>{selectedLine.expectedItem}</dd>
                </div>
                <div>
                  <dt>From Slot</dt>
                  <dd>{selectedLine.fromSlot || '—'}</dd>
                </div>
              </div>

              <CameraScanner onScan={(value) => void handleVerifyScan(value)} />

              <label>
                <span>Manual scan value</span>
                <textarea
                  className="text-input"
                  rows={5}
                  placeholder='Paste {"type":"item_label", ...} or a plain item number.'
                  value={manualScan}
                  onChange={(event) => setManualScan(event.target.value)}
                />
              </label>

              <label>
                <span>Override / review notes</span>
                <textarea
                  className="text-input"
                  rows={4}
                  placeholder="Lead/admin notes, short details, or inventory review context."
                  value={selectedLine.overrideNotes}
                  onChange={(event) =>
                    updateLine(selectedLine.id, (line) => ({
                      ...line,
                      overrideNotes: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="button-row">
                <button className="primary-button" type="button" disabled={!manualScan.trim() || isWorking} onClick={() => void handleVerifyScan(manualScan)}>
                  {isWorking ? 'Verifying…' : 'Verify Scan'}
                </button>
                <button className="secondary-button" type="button" onClick={handleMarkPicked}>
                  Mark Picked
                </button>
                <button className="secondary-button" type="button" onClick={() => void handleCheckPull()}>
                  ✓ Check Pull
                </button>
                <button className="secondary-button" type="button" onClick={() => void handleApplyOverride()}>
                  Lead/Admin Override
                </button>
                <button className="ghost-button" type="button" onClick={() => void handleMarkShort()}>
                  Mark Short
                </button>
              </div>

              <div className="detail-grid">
                <div>
                  <dt>Scanned Item</dt>
                  <dd>{selectedLine.scannedItem || '—'}</dd>
                </div>
                <div>
                  <dt>Scanned Location</dt>
                  <dd>{selectedLine.scannedLocation || '—'}</dd>
                </div>
                <div>
                  <dt>Item Master Description</dt>
                  <dd>{selectedLine.itemMasterDescription || '—'}</dd>
                </div>
                <div>
                  <dt>Last Verified</dt>
                  <dd>{selectedLine.lastVerifiedAt ? formatDateTime(selectedLine.lastVerifiedAt) : '—'}</dd>
                </div>
              </div>

              <div className="code-block">{selectedLine.verifyResult}</div>
            </div>
          ) : (
            <div className="empty-state">Upload a pick ticket and choose a line to start verification.</div>
          )}
        </SectionCard>

        <SectionCard title="Pick Queue" description="Verification results stay attached to each line so the picker and inventory team can see exactly what was scanned.">
          <DataTable
            rows={pickTicketLines}
            emptyMessage="Upload a pick ticket to populate the order-picking verification grid."
            columns={[
              { key: 'order', label: 'Order', render: (row) => row.orderNumber },
              { key: 'line', label: 'Line', render: (row) => row.lineNumber },
              { key: 'expectedItem', label: 'Expected Item', render: (row) => row.expectedItem },
              { key: 'fromSlot', label: 'From Slot', render: (row) => row.fromSlot || '—' },
              { key: 'scannedItem', label: 'Scanned Item', render: (row) => row.scannedItem || '—' },
              { key: 'scannedLocation', label: 'Scanned Location', render: (row) => row.scannedLocation || '—' },
              { key: 'description', label: 'Item Master Description', render: (row) => row.itemMasterDescription || row.expectedDescription || '—' },
              { key: 'verifyResult', label: 'Verify Result', render: (row) => <div className="table-note">{row.verifyResult}</div> },
              { key: 'pullCheck', label: 'Pull Check', render: (row) => (row.pullCheck ? '✓ Checked' : 'Pending') },
              { key: 'inventoryStatus', label: 'Inventory Status', render: (row) => <StatusBadge status={row.inventoryStatus} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <button className="chip-button" type="button" onClick={() => setSelectedLineId(row.id)}>
                    {selectedLineId === row.id ? 'Selected' : 'Open'}
                  </button>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}
