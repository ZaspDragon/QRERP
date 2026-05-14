import { useEffect, useState, type ChangeEvent } from 'react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { exportItemMasterFile, listItemMasterRecords, parseItemMasterFile, saveItemMasterRecords } from '../lib/item-master';
import { buildManualReceivingLabel, formatDocDisplay, normalizeDocNumber, parseBulkReceivingText, parseReceivingLabelFile } from '../lib/receiving-labels';
import { saveReceivingLabels } from '../lib/warehouse-store';
import { printZebraLabels } from '../utils/printing';
import { stringifyQrPayload, toQrDataUrl } from '../utils/qr';
import type { ItemMasterImportRow, ItemMasterRecord, ReceivingLabelDraft } from '../types';

type ReceivingTab = 'labels' | 'itemMaster';

export default function ReceivingPage() {
  const { currentUser, firebaseReady, firebaseError, receivingLabels, isLeadOrAdmin } = useERP();

  const [activeTab, setActiveTab] = useState<ReceivingTab>('labels');
  const [docType, setDocType] = useState('SPO');
  const [docNumber, setDocNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('1');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [uom, setUom] = useState('EA');
  const [copies, setCopies] = useState('1');
  const [bulkText, setBulkText] = useState('');
  const [labelQueue, setLabelQueue] = useState<ReceivingLabelDraft[]>([]);
  const [importPreview, setImportPreview] = useState<ReceivingLabelDraft[]>([]);
  const [importSummary, setImportSummary] = useState('');
  const [labelStatus, setLabelStatus] = useState('');
  const [labelError, setLabelError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const [previewRows, setPreviewRows] = useState<ItemMasterImportRow[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<Record<string, string>>({});
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [itemMasterStatus, setItemMasterStatus] = useState('');
  const [itemMasterError, setItemMasterError] = useState('');
  const [records, setRecords] = useState<ItemMasterRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  useEffect(() => {
    if (activeTab !== 'itemMaster' || !firebaseReady) {
      return;
    }

    void refreshItemMaster();
  }, [activeTab, firebaseReady]);

  async function refreshItemMaster() {
    setIsLoadingRecords(true);
    setItemMasterError('');

    try {
      const itemMasterRecords = await listItemMasterRecords();
      setRecords(itemMasterRecords);
    } catch (error) {
      setItemMasterError(error instanceof Error ? error.message : 'Unable to load item master records.');
    } finally {
      setIsLoadingRecords(false);
    }
  }

  function handleAddManualLabels() {
    setLabelStatus('');
    setLabelError('');

    if (!item.trim()) {
      setLabelError('Item # is required to create a manual sticker label.');
      return;
    }

    try {
      const rows = buildManualReceivingLabel({
        docType,
        docNumber: normalizeDocNumber(docNumber, docType),
        branch,
        item,
        qty: Number(qty || 0),
        description,
        location,
        uom,
        copies: Number(copies || 1),
      });

      setLabelQueue((previous) => [...previous, ...rows]);
      setLabelStatus(`Added ${rows.length} label(s) to the print queue.`);
      setItem('');
      setQty('1');
      setDescription('');
      setLocation('');
      setCopies('1');
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : 'Unable to add the manual labels.');
    }
  }

  function handleBulkAdd() {
    const rows = parseBulkReceivingText(bulkText, {
      docType,
      docNumber,
      branch,
      uom,
    });

    if (!rows.length) {
      setLabelError('No valid bulk label rows were found. Use comma-separated lines with an item number.');
      return;
    }

    setLabelQueue((previous) => [...previous, ...rows]);
    setBulkText('');
    setLabelStatus(`Added ${rows.length} bulk label(s) to the queue.`);
    setLabelError('');
  }

  async function handleStickerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLabelStatus('');
    setLabelError('');

    try {
      const parsed = await parseReceivingLabelFile(file, {
        docType,
        docNumber,
        branch,
      });

      setImportPreview(parsed.rows);
      setImportSummary(`Preview ready for ${parsed.rows.length} sticker label row(s) from ${parsed.fileName}.`);
    } catch (error) {
      setImportPreview([]);
      setImportSummary('');
      setLabelError(error instanceof Error ? error.message : 'Unable to parse the uploaded receiving file.');
    } finally {
      event.target.value = '';
    }
  }

  function handleAddImportedRowsToQueue() {
    if (!importPreview.length) {
      return;
    }

    setLabelQueue((previous) => [...previous, ...importPreview]);
    setLabelStatus(`Added ${importPreview.length} imported sticker label row(s) to the queue.`);
  }

  async function handleSaveQueue() {
    if (!currentUser || !labelQueue.length) {
      return;
    }

    setIsWorking(true);
    setLabelStatus('');
    setLabelError('');

    try {
      const saved = await saveReceivingLabels(labelQueue, currentUser);
      setLabelStatus(`Saved ${saved} receiving label row(s) to Firestore.`);
      setLabelQueue([]);
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : 'Unable to save the sticker label queue.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePrintQueue() {
    if (!labelQueue.length) {
      return;
    }

    const printable = await Promise.all(
      labelQueue.map(async (row) => ({
        title: row.description || row.item,
        subtitle: formatDocDisplay(row),
        details: [`Item: ${row.item}`, `Qty: ${row.qty}`, `Loc: ${row.location || 'N/A'}`, `UOM: ${row.uom || 'N/A'}`],
        qrImageSrc: await toQrDataUrl(stringifyQrPayload(row.qrPayload), 180),
      })),
    );

    printZebraLabels(printable);
  }

  async function handleItemMasterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setItemMasterStatus('');
    setItemMasterError('');

    try {
      const parsed = await parseItemMasterFile(file);
      setImportFileName(parsed.fileName);
      setDetectedHeaders(parsed.detectedHeaders);
      setHeaderRowIndex(parsed.headerRowIndex);
      setPreviewRows(parsed.rows);
      setItemMasterStatus(`Preview ready for ${parsed.rows.length} rows from ${parsed.sheetName}.`);
    } catch (error) {
      setPreviewRows([]);
      setDetectedHeaders({});
      setHeaderRowIndex(null);
      setItemMasterError(error instanceof Error ? error.message : 'Unable to parse Item Availability.xlsx.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleSaveItemMaster() {
    if (!currentUser || !previewRows.length) {
      return;
    }

    setIsWorking(true);
    setItemMasterStatus('');
    setItemMasterError('');

    try {
      const saved = await saveItemMasterRecords(previewRows, currentUser);
      setItemMasterStatus(`Saved ${saved} rows to Firestore itemMaster from ${importFileName || 'Item Availability.xlsx'}.`);
      await refreshItemMaster();
    } catch (error) {
      setItemMasterError(error instanceof Error ? error.message : 'Unable to save the item master rows.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExportItemMaster(format: 'xlsx' | 'csv') {
    setItemMasterStatus('');
    setItemMasterError('');

    try {
      const total = await exportItemMasterFile(format);
      setItemMasterStatus(`Exported ${total} item master rows to ${format.toUpperCase()}.`);
    } catch (error) {
      setItemMasterError(error instanceof Error ? error.message : 'Unable to export item master.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inbound + Labels"
        title="Receiving / Sticker Labels"
        description="Merge receiving label creation, bulk import, printable 4x2 Zebra labels, and the Item Availability item master workflow into one fast warehouse module."
      />

      {!firebaseReady ? <div className="info-banner warning-banner">{firebaseError}</div> : null}

      <div className="tab-row">
        <button className={`tab-button${activeTab === 'labels' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('labels')}>
          QR Labels
        </button>
        <button className={`tab-button${activeTab === 'itemMaster' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('itemMaster')}>
          Item Master
        </button>
      </div>

      {activeTab === 'labels' ? (
        <div className="page-stack">
          <div className="split-layout">
            <SectionCard title="Manual QR Label Creation" description="Create item identity labels manually for receiving or sticker work.">
              <div className="stack-form">
                <div className="inline-form-grid">
                  <label>
                    <span>Doc Type</span>
                    <select className="text-input" value={docType} onChange={(event) => setDocType(event.target.value)}>
                      <option value="PO">PO</option>
                      <option value="SPO">SPO</option>
                      <option value="SXFR">SXFR</option>
                      <option value="XFR">XFR</option>
                    </select>
                  </label>
                  <label>
                    <span>Doc Number</span>
                    <input className="text-input" value={docNumber} onChange={(event) => setDocNumber(event.target.value)} placeholder="SPO123456" />
                  </label>
                  <label>
                    <span>Branch</span>
                    <input className="text-input" value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="NY01" />
                  </label>
                  <label>
                    <span>Item #</span>
                    <input className="text-input" value={item} onChange={(event) => setItem(event.target.value)} placeholder="552103" />
                  </label>
                  <label>
                    <span>Qty</span>
                    <input className="text-input" type="number" min="0" value={qty} onChange={(event) => setQty(event.target.value)} />
                  </label>
                  <label>
                    <span>UOM</span>
                    <input className="text-input" value={uom} onChange={(event) => setUom(event.target.value)} placeholder="EA" />
                  </label>
                  <label>
                    <span>Location</span>
                    <input className="text-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="A-02-2" />
                  </label>
                  <label>
                    <span>Copies</span>
                    <input className="text-input" type="number" min="1" value={copies} onChange={(event) => setCopies(event.target.value)} />
                  </label>
                </div>
                <label>
                  <span>Description</span>
                  <input className="text-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="60 VERTICAL BLIND SLAT - WHITE" />
                </label>
                <div className="button-row">
                  <button className="primary-button" type="button" onClick={handleAddManualLabels}>
                    Add Manual Labels
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setLabelQueue([])} disabled={!labelQueue.length}>
                    Clear Queue
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Bulk Paste Label Creation" description="Paste comma-separated lines to generate multiple receiving labels fast.">
              <div className="stack-form">
                <label>
                  <span>Bulk paste</span>
                  <textarea
                    className="text-input"
                    rows={10}
                    value={bulkText}
                    onChange={(event) => setBulkText(event.target.value)}
                    placeholder="SPO,SPO123456,NY01,552103,12,60 VERTICAL BLIND SLAT - WHITE,A-02-2,PK"
                  />
                </label>
                <div className="button-row">
                  <button className="primary-button" type="button" onClick={handleBulkAdd}>
                    Add Bulk Labels
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="PO / SPO / SXFR / XFR File Import" description="Upload Excel or CSV receiving files, preview the rows, and add them to the sticker label queue.">
            <div className="stack-form">
              <label>
                <span>Upload file</span>
                <input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleStickerFile} />
              </label>
              {importSummary ? <div className="info-banner success-banner">{importSummary}</div> : null}
              {labelStatus ? <div className="info-banner success-banner">{labelStatus}</div> : null}
              {labelError ? <div className="info-banner danger-banner">{labelError}</div> : null}
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={handleAddImportedRowsToQueue} disabled={!importPreview.length}>
                  Add Imported Rows to Queue
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Import Preview" description="Preview receiving rows before adding them to the label queue.">
            <DataTable
              rows={importPreview.slice(0, 40)}
              emptyMessage="Upload a PO / SPO / SXFR / XFR file to preview sticker label rows."
              columns={[
                { key: 'docType', label: 'Doc Type', render: (row) => row.docType },
                { key: 'docNumber', label: 'Doc Number', render: (row) => formatDocDisplay(row) },
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'qty', label: 'Qty', render: (row) => row.qty },
                { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                { key: 'location', label: 'Location', render: (row) => row.location || '—' },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Printable 4x2 Zebra Labels"
            description="Queue labels here, save them to Firestore receivingLabels, and print QR code sheets."
            actions={
              <div className="button-row">
                <button className="primary-button" type="button" disabled={!labelQueue.length} onClick={() => void handlePrintQueue()}>
                  Print 4x2 Zebra Labels
                </button>
                <button className="secondary-button" type="button" disabled={!labelQueue.length || !currentUser || !firebaseReady || isWorking} onClick={() => void handleSaveQueue()}>
                  {isWorking ? 'Saving...' : 'Save Queue to Firestore'}
                </button>
              </div>
            }
          >
            <DataTable
              rows={labelQueue}
              emptyMessage="Manual, bulk, and imported labels will collect here before printing."
              columns={[
                { key: 'doc', label: 'Doc #', render: (row) => formatDocDisplay(row) },
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'qty', label: 'Qty', render: (row) => row.qty },
                { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                { key: 'location', label: 'Location', render: (row) => row.location || '—' },
                { key: 'payload', label: 'QR Payload', render: (row) => <div className="table-note compact-note">{stringifyQrPayload(row.qrPayload)}</div> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Saved Receiving Labels" description="Latest receivingLabels rows already saved to Firestore.">
            <DataTable
              rows={receivingLabels.slice(0, 30)}
              emptyMessage="No receiving labels have been saved yet."
              columns={[
                { key: 'docType', label: 'Doc Type', render: (row) => row.docType },
                { key: 'docNumber', label: 'Doc Number', render: (row) => row.docNumber },
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'qty', label: 'Qty', render: (row) => row.qty },
                { key: 'location', label: 'Location', render: (row) => row.location || '—' },
                { key: 'source', label: 'Source File', render: (row) => row.sourceFile || '—' },
              ]}
            />
          </SectionCard>
        </div>
      ) : (
        <div className="page-stack">
          <SectionCard title="Item Master Import" description="Upload Item Availability.xlsx, auto-detect the header row, preview normalized rows, and save them into Firestore itemMaster.">
            <div className="stack-form">
              <label>
                <span>Upload Item Availability.xlsx</span>
                <input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleItemMasterFile} />
              </label>
              {headerRowIndex !== null ? (
                <div className="code-block">
                  Header row detected at Excel row {headerRowIndex + 1}.
                  {'\n'}
                  {Object.entries(detectedHeaders)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')}
                </div>
              ) : null}
              {itemMasterStatus ? <div className="info-banner success-banner">{itemMasterStatus}</div> : null}
              {itemMasterError ? <div className="info-banner danger-banner">{itemMasterError}</div> : null}
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={!previewRows.length || !currentUser || !firebaseReady || !isLeadOrAdmin || isWorking}
                  onClick={() => void handleSaveItemMaster()}
                >
                  {isWorking ? 'Saving...' : 'Save Item Availability to Item Master'}
                </button>
                <button className="secondary-button" type="button" disabled={!firebaseReady} onClick={() => void handleExportItemMaster('xlsx')}>
                  Export Item Master Excel
                </button>
                <button className="secondary-button" type="button" disabled={!firebaseReady} onClick={() => void handleExportItemMaster('csv')}>
                  Export Item Master CSV
                </button>
              </div>
              {!isLeadOrAdmin ? <div className="info-banner warning-banner">Lead or admin access is required to save item master rows.</div> : null}
            </div>
          </SectionCard>

          <SectionCard title="Import Preview" description="Review normalized item master rows before saving.">
            <DataTable
              rows={previewRows.slice(0, 50)}
              emptyMessage="Upload Item Availability.xlsx to preview the item master rows."
              columns={[
                { key: 'row', label: 'Row', render: (row) => row.rowNumber },
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                { key: 'availableQty', label: 'Available Qty', render: (row) => row.availableQty },
                { key: 'location', label: 'Location', render: (row) => row.defaultLocation || row.binLocation || '—' },
                { key: 'uom', label: 'UOM', render: (row) => row.uom || '—' },
                { key: 'category', label: 'Category', render: (row) => row.category || '—' },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Current Firestore Item Master"
            description="The fast lookup database used during scan verification and inventory lookup."
            actions={
              <button className="secondary-button" type="button" disabled={!firebaseReady || isLoadingRecords} onClick={() => void refreshItemMaster()}>
                {isLoadingRecords ? 'Refreshing...' : 'Refresh Snapshot'}
              </button>
            }
          >
            <DataTable
              rows={records.slice(0, 30)}
              emptyMessage="No item master records are loaded yet."
              columns={[
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                { key: 'availableQty', label: 'Available Qty', render: (row) => row.availableQty },
                { key: 'defaultLocation', label: 'Default Location', render: (row) => row.defaultLocation || '—' },
                { key: 'binLocation', label: 'Bin', render: (row) => row.binLocation || '—' },
                { key: 'updatedBy', label: 'Updated By', render: (row) => row.updatedBy || '—' },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
