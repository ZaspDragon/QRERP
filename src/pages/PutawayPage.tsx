import { useEffect, useMemo, useState } from 'react';
import CameraScanner from '../components/qr/CameraScanner';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import { useERP } from '../context/ERPContext';
import { downloadCsv, recordQrScan, savePutAwaySession } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';
import { createId, parseQrScan } from '../utils/qr';
import type { PutAwayLine, PutAwaySession } from '../types';

function createEmptyLine(lineNumber: number): PutAwayLine {
  return {
    id: createId(`put-${lineNumber}`),
    lineNumber,
    item: '',
    description: '',
    qty: 0,
    location: '',
    notes: '',
    scannedItemRaw: '',
    scannedLocationRaw: '',
  };
}

function calculateDockToStockMinutes(receivedTime: string, stockedTime: string) {
  if (!receivedTime || !stockedTime) {
    return 0;
  }

  const start = new Date(receivedTime);
  const end = new Date(stockedTime);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return minutes >= 0 ? minutes : 0;
}

export default function PutawayPage() {
  const { currentUser, putAwayLogs, firebaseReady } = useERP();
  const [docNumber, setDocNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedTime, setReceivedTime] = useState('');
  const [stockedTime, setStockedTime] = useState('');
  const [manualScan, setManualScan] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [lines, setLines] = useState<PutAwayLine[]>(() => Array.from({ length: 8 }, (_, index) => createEmptyLine(index + 1)));
  const [selectedLineId, setSelectedLineId] = useState<string>('');

  const selectedLine = useMemo(() => lines.find((line) => line.id === selectedLineId) ?? lines[0] ?? null, [lines, selectedLineId]);
  const dockToStockMinutes = calculateDockToStockMinutes(receivedTime, stockedTime);
  const usedLines = lines.filter((line) => line.item || line.location || line.qty || line.notes).length;
  const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);

  function updateLine(lineId: string, updater: (line: PutAwayLine) => PutAwayLine) {
    setLines((previous) => previous.map((line) => (line.id === lineId ? updater(line) : line)));
  }

  function addRow() {
    setLines((previous) => [...previous, createEmptyLine(previous.length + 1)]);
  }

  useEffect(() => {
    if (!selectedLineId && lines[0]) {
      setSelectedLineId(lines[0].id);
      return;
    }

    if (selectedLineId && !lines.some((line) => line.id === selectedLineId) && lines[0]) {
      setSelectedLineId(lines[0].id);
    }
  }, [lines, selectedLineId]);

  async function applyScan(rawValue: string, scanSource: 'camera' | 'manual') {
    if (!currentUser || !selectedLine) {
      return;
    }

    const parsed = parseQrScan(rawValue);

    if (parsed.parsedType === 'unknown') {
      setError('The scanned QR value was not recognized as an item label, item number, or location label.');
      return;
    }

    setStatus('');
    setError('');

    const nextLine: PutAwayLine = {
      ...selectedLine,
      item:
        parsed.parsedType === 'item_label' || parsed.parsedType === 'item_number'
          ? parsed.item
          : selectedLine.item,
      description: parsed.description || selectedLine.description,
      qty: parsed.qty || selectedLine.qty,
      location: parsed.parsedType === 'location' ? parsed.location : parsed.location || selectedLine.location,
      scannedItemRaw:
        parsed.parsedType === 'item_label' || parsed.parsedType === 'item_number'
          ? parsed.rawValue
          : selectedLine.scannedItemRaw,
      scannedLocationRaw: parsed.parsedType === 'location' ? parsed.rawValue : selectedLine.scannedLocationRaw,
    };

    updateLine(selectedLine.id, () => nextLine);

    if (firebaseReady) {
      await recordQrScan({
        rawValue,
        parsedType: parsed.parsedType,
        item: parsed.item,
        location: parsed.location,
        description: parsed.description,
        qty: parsed.qty,
        sourceModule: 'putaway',
        documentNumber: docNumber.trim(),
        sessionId: 'draft-putaway',
        expectedItem: '',
        expectedLocation: '',
        result: 'Captured for put away',
        scanSource,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
      });
    }

    setStatus(
      parsed.parsedType === 'location'
        ? `Location scanned into line ${selectedLine.lineNumber}: ${parsed.location}`
        : `Item scanned into line ${selectedLine.lineNumber}: ${parsed.item}`,
    );
    setManualScan('');
  }

  async function handleSave() {
    if (!currentUser) {
      return;
    }

    const used = lines.filter((line) => line.item || line.location || line.qty || line.notes);

    if (!used.length) {
      setError('Enter or scan at least one put away line.');
      return;
    }

    setIsWorking(true);
    setStatus('');
    setError('');

    try {
      const session: PutAwaySession = {
        id: createId('putaway-session'),
        worker: currentUser.name,
        date,
        docNumber: docNumber.trim(),
        receivedTime,
        stockedTime,
        dockToStockMinutes,
        lines: used,
        lineCount: used.length,
        totalQty: used.reduce((sum, line) => sum + line.qty, 0),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
      };

      await savePutAwaySession(session);
      setStatus(`Saved put away log with ${used.length} line(s).`);
      setLines(Array.from({ length: 8 }, (_, index) => createEmptyLine(index + 1)));
      setReceivedTime('');
      setStockedTime('');
      setDocNumber('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the put away log.');
    } finally {
      setIsWorking(false);
    }
  }

  function handleExportCsv() {
    const used = lines.filter((line) => line.item || line.location || line.qty || line.notes);

    downloadCsv(
      used.map((line) => ({
        lineNumber: line.lineNumber,
        item: line.item,
        description: line.description,
        qty: line.qty,
        location: line.location,
        notes: line.notes,
        docNumber,
        date,
      })),
      `putaway-${date}.csv`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Directed Storage"
        title="Put Away"
        description="Scan item QR labels to capture item identity, scan location labels to capture bin locations, keep dock-to-stock timing, and save the put away log plus QR scan history."
      />

      <section className="stat-grid">
        <StatCard label="Active Lines" value={`${usedLines}`} helper="Current worksheet rows with put away data" />
        <StatCard label="Total Qty" value={`${totalQty}`} helper="Current total quantity staged for save" />
        <StatCard label="Dock To Stock" value={`${dockToStockMinutes}`} helper="Minutes from received to stocked" />
        <StatCard label="Saved Logs" value={`${putAwayLogs.length}`} helper="Historical put away sessions in Firestore" />
      </section>

      <div className="split-layout">
        <SectionCard title="Put Away Scan Panel" description="Select a row, then scan item and location QR codes into it.">
          <div className="stack-form">
            <div className="inline-form-grid">
              <label>
                <span>Document #</span>
                <input className="text-input" value={docNumber} onChange={(event) => setDocNumber(event.target.value)} placeholder="PO123456" />
              </label>
              <label>
                <span>Date</span>
                <input className="text-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                <span>Received Time</span>
                <input className="text-input" type="datetime-local" value={receivedTime} onChange={(event) => setReceivedTime(event.target.value)} />
              </label>
              <label>
                <span>Stocked Time</span>
                <input className="text-input" type="datetime-local" value={stockedTime} onChange={(event) => setStockedTime(event.target.value)} />
              </label>
            </div>

            {selectedLine ? (
              <div className="detail-grid">
                <div>
                  <dt>Selected Line</dt>
                  <dd>{selectedLine.lineNumber}</dd>
                </div>
                <div>
                  <dt>Item</dt>
                  <dd>{selectedLine.item || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selectedLine.location || '—'}</dd>
                </div>
                <div>
                  <dt>Qty</dt>
                  <dd>{selectedLine.qty || '—'}</dd>
                </div>
              </div>
            ) : null}

            <CameraScanner onScan={(value) => void applyScan(value, 'camera')} />

            <label>
              <span>Manual scan value</span>
              <textarea
                className="text-input"
                rows={5}
                value={manualScan}
                onChange={(event) => setManualScan(event.target.value)}
                placeholder='Paste {"type":"item_label", ...} or LOC:A-02-2'
              />
            </label>

            {status ? <div className="verification-banner success">{status}</div> : null}
            {error ? <div className="verification-banner danger">{error}</div> : null}

            <div className="button-row">
              <button className="primary-button" type="button" disabled={!manualScan.trim()} onClick={() => void applyScan(manualScan, 'manual')}>
                Apply Manual Scan
              </button>
              <button className="secondary-button" type="button" onClick={addRow}>
                Add Row
              </button>
              <button className="secondary-button" type="button" disabled={!usedLines} onClick={handleExportCsv}>
                Export CSV
              </button>
              <button className="secondary-button" type="button" disabled={!currentUser || isWorking} onClick={() => void handleSave()}>
                {isWorking ? 'Saving...' : 'Save Put Away Log'}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Put Away Worksheet" description="Edit or review the current put away rows before saving.">
          <DataTable
            rows={lines}
            emptyMessage="No put away rows are available."
            columns={[
              {
                key: 'line',
                label: 'Line',
                render: (row) => (
                  <button className="chip-button" type="button" onClick={() => setSelectedLineId(row.id)}>
                    {selectedLineId === row.id ? `Line ${row.lineNumber}` : `Select ${row.lineNumber}`}
                  </button>
                ),
              },
              { key: 'item', label: 'Item', render: (row) => row.item || '—' },
              { key: 'description', label: 'Description', render: (row) => row.description || '—' },
              { key: 'qty', label: 'Qty', render: (row) => row.qty || '—' },
              { key: 'location', label: 'Location', render: (row) => row.location || '—' },
              {
                key: 'notes',
                label: 'Notes',
                render: (row) => (
                  <input
                    className="table-input"
                    value={row.notes}
                    onChange={(event) =>
                      updateLine(row.id, (line) => ({
                        ...line,
                        notes: event.target.value,
                      }))
                    }
                  />
                ),
              },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Recent Put Away Logs" description="Latest Firestore put away sessions preserved from the working warehouse module.">
        <DataTable
          rows={putAwayLogs.slice(0, 12)}
          emptyMessage="No put away sessions have been saved yet."
          columns={[
            { key: 'date', label: 'Date', render: (row) => row.date || '—' },
            { key: 'worker', label: 'Worker', render: (row) => row.worker || '—' },
            { key: 'docNumber', label: 'Document #', render: (row) => row.docNumber || '—' },
            { key: 'lineCount', label: 'Lines', render: (row) => row.lineCount },
            { key: 'totalQty', label: 'Total Qty', render: (row) => row.totalQty },
            { key: 'dockToStockMinutes', label: 'Dock To Stock', render: (row) => `${row.dockToStockMinutes} min` },
            { key: 'createdAt', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
          ]}
        />
      </SectionCard>
    </div>
  );
}
