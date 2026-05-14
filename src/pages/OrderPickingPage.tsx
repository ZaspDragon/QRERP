import { useMemo, useState, type ChangeEvent } from 'react';
import CameraScanner from '../components/qr/CameraScanner';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { getItemMasterRecord } from '../lib/item-master';
import { applyOverride, applyPickScan, canMarkPicked, markLinePicked, parsePickTicketFile, updatePickedQty } from '../lib/pick-ticket';
import { downloadCsv, recordQrScan, saveOrderPickingSession, saveScanVerification, upsertPullConfirmation } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';
import { createId, parseQrScan } from '../utils/qr';
import type { OrderPickingSession, PickTicketLine, PullConfirmationRecord } from '../types';

export default function OrderPickingPage() {
  const { currentUser, isLeadOrAdmin, orderPickingSessions, firebaseReady } = useERP();
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pickTicketLines, setPickTicketLines] = useState<PickTicketLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
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
  const verifiedLines = pickTicketLines.filter((line) => ['Verified', 'Override Approved', 'Picked'].includes(line.status)).length;
  const issueLines = pickTicketLines.filter((line) => ['Needs Review', 'Short'].includes(line.status)).length;
  const sentToInventory = pickTicketLines.filter((line) => line.inventoryStatus === '✅ Sent to Inventory').length;

  function updateLine(lineId: string, updater: (line: PickTicketLine) => PickTicketLine) {
    setPickTicketLines((previous) => previous.map((line) => (line.id === lineId ? updater(line) : line)));
  }

  async function recordVerification(line: PickTicketLine, overallResult: string) {
    if (!currentUser || !firebaseReady) {
      return;
    }

    await saveScanVerification({
      documentNumber: line.orderNumber,
      pickTicketId: line.pickTicketId,
      lineId: line.id,
      expectedItem: line.expectedItem,
      expectedLocation: line.fromSlot,
      scannedItem: line.scannedItem,
      scannedLocation: line.scannedLocation,
      itemMasterDescription: line.itemMasterDescription,
      itemStatus: line.itemStatus,
      locationStatus: line.locationStatus,
      overallResult,
      notes: line.overrideNotes,
      overrideUsed: Boolean(line.overrideBy),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email,
    });
  }

  async function recordScan(rawValue: string, line: PickTicketLine, result: string, scanSource: 'camera' | 'manual') {
    if (!currentUser || !firebaseReady) {
      return;
    }

    const parsed = parseQrScan(rawValue);

    await recordQrScan({
      rawValue,
      parsedType: parsed.parsedType,
      item: parsed.item || line.scannedItem,
      location: parsed.location || line.scannedLocation,
      description: parsed.description || line.itemMasterDescription,
      qty: parsed.qty,
      sourceModule: 'order-picking',
      documentNumber: line.orderNumber,
      sessionId: line.pickTicketId,
      expectedItem: line.expectedItem,
      expectedLocation: line.fromSlot,
      result,
      scanSource,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email,
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
      setSessionDate(new Date().toISOString().slice(0, 10));
      setPageStatus(`Loaded ${parsed.rows.length} pick ticket lines from ${parsed.fileName}.`);
      setManualScan('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to parse the uploaded pick ticket.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleVerifyScan(rawValue: string, scanSource: 'camera' | 'manual') {
    if (!selectedLine) {
      setPageError('Select a pick ticket line before scanning.');
      return;
    }

    const parsed = parseQrScan(rawValue);

    if (parsed.parsedType === 'unknown') {
      setPageError('The scanned value was not recognized as an item label, item number, or location label.');
      return;
    }

    setIsWorking(true);
    setPageStatus('');
    setPageError('');

    try {
      const lookupItem = parsed.item || selectedLine.scannedItem || selectedLine.expectedItem;
      const itemMaster = lookupItem ? await getItemMasterRecord(lookupItem) : null;
      const { line: nextLine, overallResult } = applyPickScan(selectedLine, rawValue, itemMaster);

      updateLine(selectedLine.id, () => nextLine);
      await recordVerification(nextLine, overallResult);
      await recordScan(rawValue, nextLine, overallResult, scanSource);

      setPageStatus(overallResult);
      setManualScan('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to verify the scan.');
    } finally {
      setIsWorking(false);
    }
  }

  function handleMarkPicked() {
    if (!selectedLine) {
      return;
    }

    if (!canMarkPicked(selectedLine)) {
      setPageError('This row cannot become Picked until the scanned item matches the expected item or a lead/admin override is recorded.');
      return;
    }

    updateLine(selectedLine.id, (line) => markLinePicked(line));
    setPageStatus(`Line ${selectedLine.lineNumber} is marked Picked.`);
    setPageError('');
  }

  async function handleApplyOverride() {
    if (!currentUser || !selectedLine) {
      return;
    }

    if (!isLeadOrAdmin) {
      setPageError('Only a lead or admin can apply an override.');
      return;
    }

    if (!selectedLine.overrideNotes.trim()) {
      setPageError('Override notes are required.');
      return;
    }

    const nextLine = applyOverride(selectedLine, currentUser.name, currentUser.email);
    updateLine(selectedLine.id, () => nextLine);
    await recordVerification(nextLine, 'Override Approved');
    setPageStatus(`Override approved by ${currentUser.name}.`);
    setPageError('');
  }

  async function savePullForLine(line: PickTicketLine) {
    if (!currentUser) {
      return false;
    }

    if (line.pickedQty <= 0) {
      throw new Error(`Line ${line.lineNumber} must have picked qty greater than zero.`);
    }

    const itemVerified = line.scannedItem.trim() && line.scannedItem.trim().toUpperCase() === line.expectedItem.trim().toUpperCase();

    if (!itemVerified && !line.overrideBy) {
      throw new Error(`Line ${line.lineNumber} must have a correct item verification or override before pull confirmation.`);
    }

    const pullId = `${line.orderNumber}-${line.expectedItem}-${line.fromSlot || 'NOSLOT'}`;
    const record: PullConfirmationRecord = {
      id: pullId,
      documentNumber: line.orderNumber,
      pickTicketId: line.pickTicketId,
      lineId: line.id,
      item: line.expectedItem,
      description: line.itemMasterDescription || line.expectedDescription,
      location: line.scannedLocation || line.fromSlot,
      pickedQty: line.pickedQty,
      inventoryStatus: '✅ Sent to Inventory',
      active: true,
      notes: line.overrideNotes,
      createdBy: currentUser.name,
      createdByEmail: currentUser.email,
      updatedBy: currentUser.name,
      updatedByEmail: currentUser.email,
    };

    await upsertPullConfirmation(record);
    return true;
  }

  async function handleCheckPull(line: PickTicketLine | null = selectedLine) {
    if (!line) {
      return;
    }

    setIsWorking(true);
    setPageStatus('');
    setPageError('');

    try {
      await savePullForLine(line);

      updateLine(line.id, (current) => ({
        ...current,
        pullCheck: true,
        inventoryStatus: '✅ Sent to Inventory',
        lastPullQty: current.pickedQty,
      }));

      setPageStatus(`Pull confirmation saved for item ${line.expectedItem}.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to save the pull confirmation.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleFinishTicket() {
    if (!currentUser || !pickTicketLines.length) {
      return;
    }

    setIsWorking(true);
    setPageStatus('');
    setPageError('');

    let sent = 0;
    let skipped = 0;
    const nextLines = [...pickTicketLines];

    try {
      for (const line of nextLines.filter((entry) => entry.pickedQty > 0)) {
        try {
          await savePullForLine(line);
          sent += 1;
          const lineIndex = nextLines.findIndex((entry) => entry.id === line.id);
          if (lineIndex >= 0) {
            nextLines[lineIndex] = {
              ...nextLines[lineIndex],
              pullCheck: true,
              inventoryStatus: '✅ Sent to Inventory',
              lastPullQty: nextLines[lineIndex].pickedQty,
            };
          }
        } catch {
          skipped += 1;
        }
      }

      setPickTicketLines(nextLines);

      const orderNumber = nextLines[0]?.orderNumber ?? '';
      const session: OrderPickingSession = {
        id: createId('pick-session'),
        picker: currentUser.name,
        date: sessionDate,
        orderNumber,
        lines: nextLines,
        lineCount: nextLines.length,
        totalPicked: nextLines.reduce((sum, line) => sum + line.pickedQty, 0),
        issueLines: nextLines.filter((line) => ['Needs Review', 'Short'].includes(line.status)).length,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
      };

      await saveOrderPickingSession(session);
      setPageStatus(`Finish Ticket sent ${sent} line(s) to inventory. ${skipped ? `${skipped} line(s) still need review.` : ''}`.trim());
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to finish the ticket.');
    } finally {
      setIsWorking(false);
    }
  }

  function handlePickedQtyChange(lineId: string, value: string) {
    updateLine(lineId, (line) => updatePickedQty(line, Number(value || 0)));
  }

  function handleExportCsv() {
    downloadCsv(
      pickTicketLines.map((line) => ({
        orderNumber: line.orderNumber,
        lineNumber: line.lineNumber,
        expectedItem: line.expectedItem,
        expectedDescription: line.expectedDescription,
        fromSlot: line.fromSlot,
        requiredQty: line.requiredQty,
        availableQty: line.availableQty,
        pickedQty: line.pickedQty,
        scannedItem: line.scannedItem,
        scannedLocation: line.scannedLocation,
        itemMasterDescription: line.itemMasterDescription,
        verifyResult: line.verifyResult,
        status: line.status,
        pullCheck: line.pullCheck,
        inventoryStatus: line.inventoryStatus,
        overrideNotes: line.overrideNotes,
      })),
      `${pickTicketLines[0]?.orderNumber || 'pick-ticket'}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Outbound Verification"
        title="Order Picking"
        description="Upload pick tickets with SheetJS, verify item and location QR scans against expected lines, block Picked unless item match or override exists, and send pulls to inventory."
      />

      <section className="stat-grid">
        <StatCard label="Uploaded Lines" value={`${pickTicketLines.length}`} helper="Rows loaded from the active pick ticket" />
        <StatCard label="Verified Lines" value={`${verifiedLines}`} helper="Correct item match or override approved" />
        <StatCard label="Picked Lines" value={`${pickedLines}`} helper={`${issueLines} line(s) currently need review`} />
        <StatCard label="Sent To Inventory" value={`${sentToInventory}`} helper={`${orderPickingSessions.length} saved picking session(s)`} />
      </section>

      <SectionCard title="Pick Ticket Upload" description="Upload an Excel or CSV pick ticket. Expected item numbers become the verification targets.">
        <div className="stack-form">
          <div className="inline-form-grid">
            <label>
              <span>Session Date</span>
              <input className="text-input" type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
            </label>
            <label>
              <span>Pick Ticket File</span>
              <input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={handlePickTicketUpload} />
            </label>
          </div>
          {headerSummary ? <div className="code-block">{headerSummary}</div> : null}
          {pageStatus ? (
            <div className={`verification-banner ${pageStatus.includes('❌') ? 'danger' : pageStatus.includes('⚠️') ? 'warning' : 'success'}`}>{pageStatus}</div>
          ) : null}
          {pageError ? <div className="verification-banner danger">{pageError}</div> : null}
        </div>
      </SectionCard>

      <div className="split-layout">
        <SectionCard title="Selected Line Verification" description="Scan item and location QR values into the selected row. Item and location scans can happen separately.">
          {selectedLine ? (
            <div className="stack-form">
              <div className="detail-grid">
                <div>
                  <dt>Document #</dt>
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

              <CameraScanner onScan={(value) => void handleVerifyScan(value, 'camera')} />

              <label>
                <span>Manual scan value</span>
                <textarea
                  className="text-input"
                  rows={5}
                  value={manualScan}
                  onChange={(event) => setManualScan(event.target.value)}
                  placeholder='Paste {"type":"item_label", ...}, a plain item number, or LOC:A-02-2'
                />
              </label>

              <label>
                <span>Picked Qty</span>
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  value={selectedLine.pickedQty}
                  onChange={(event) => handlePickedQtyChange(selectedLine.id, event.target.value)}
                />
              </label>

              <label>
                <span>Override Notes</span>
                <textarea
                  className="text-input"
                  rows={4}
                  value={selectedLine.overrideNotes}
                  onChange={(event) =>
                    updateLine(selectedLine.id, (line) => ({
                      ...line,
                      overrideNotes: event.target.value,
                    }))
                  }
                  placeholder="Lead/admin notes required for override."
                />
              </label>

              <div className="button-row">
                <button className="primary-button" type="button" disabled={!manualScan.trim() || isWorking} onClick={() => void handleVerifyScan(manualScan, 'manual')}>
                  {isWorking ? 'Verifying...' : 'Verify Scan'}
                </button>
                <button className="secondary-button" type="button" onClick={handleMarkPicked}>
                  Mark Picked
                </button>
                <button className="secondary-button" type="button" onClick={() => void handleCheckPull()}>
                  ✓ Check Pull
                </button>
                <button className="secondary-button" type="button" disabled={!isLeadOrAdmin} onClick={() => void handleApplyOverride()}>
                  Lead/Admin Override
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

              <div className={`verification-banner ${selectedLine.verifyResult.includes('❌') ? 'danger' : selectedLine.verifyResult.includes('⚠️') ? 'warning' : 'success'}`}>
                {selectedLine.verifyResult}
              </div>
            </div>
          ) : (
            <div className="empty-state">Upload a pick ticket and choose a line to start verification.</div>
          )}
        </SectionCard>

        <SectionCard
          title="Order Picking Worksheet"
          description="Verification columns stay attached to each line and control whether the row can move forward."
          actions={
            <div className="button-row">
              <button className="secondary-button" type="button" disabled={!pickTicketLines.length} onClick={handleExportCsv}>
                Export Current Picking CSV
              </button>
              <button className="primary-button" type="button" disabled={!pickTicketLines.length || isWorking} onClick={() => void handleFinishTicket()}>
                {isWorking ? 'Finishing...' : 'Finish Ticket'}
              </button>
            </div>
          }
        >
          <DataTable
            rows={pickTicketLines}
            emptyMessage="Upload a pick ticket to populate the verification grid."
            columns={[
              { key: 'document', label: 'Document #', render: (row) => row.orderNumber },
              { key: 'line', label: 'Line', render: (row) => row.lineNumber },
              { key: 'expectedItem', label: 'Expected Item', render: (row) => row.expectedItem },
              { key: 'fromSlot', label: 'From Slot', render: (row) => row.fromSlot || '—' },
              { key: 'pickedQty', label: 'Picked Qty', render: (row) => row.pickedQty },
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
