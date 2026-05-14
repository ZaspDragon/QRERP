import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { exportItemMasterFile, listItemMasterRecords, parseItemMasterFile, saveItemMasterRecords } from '../lib/item-master';
import { getFirebaseConfigError, isFirebaseConfigured } from '../lib/firebase';
import { printLabel } from '../utils/printing';
import { buildPayload, stringifyPayload } from '../utils/qr';
import type { ItemMasterImportRow, ItemMasterRecord, QRType } from '../types';

type GeneratorTab = 'labels' | 'itemMaster';

function metadataToText(metadata: Record<string, string>) {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function textToMetadata(value: string) {
  return value.split('\n').reduce<Record<string, string>>((accumulator, row) => {
    const [key, ...rest] = row.split(':');
    if (!key || !rest.length) {
      return accumulator;
    }

    accumulator[key.trim()] = rest.join(':').trim();
    return accumulator;
  }, {});
}

export default function GeneratorPage() {
  const navigate = useNavigate();
  const { currentUser, payloadPresets, scanQr, settings } = useERP();
  const firebaseReady = isFirebaseConfigured();
  const firebaseError = getFirebaseConfigError();

  const [activeTab, setActiveTab] = useState<GeneratorTab>('labels');
  const [qrImage, setQrImage] = useState('');
  const [type, setType] = useState<QRType>('ITEM');
  const [entityId, setEntityId] = useState('ITEM-1001');
  const [code, setCode] = useState('SKU-AX14');
  const [label, setLabel] = useState('Legends Safety Gloves');
  const [site, setSite] = useState(settings.siteName);
  const [metadataText, setMetadataText] = useState('bin: BIN-A1-01\npallet: PALLET-201');

  const [previewRows, setPreviewRows] = useState<ItemMasterImportRow[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<Record<string, string>>({});
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [records, setRecords] = useState<ItemMasterRecord[]>([]);

  const payload = buildPayload({
    type,
    entityId,
    code,
    label,
    site,
    metadata: textToMetadata(metadataText),
  });
  const payloadText = stringifyPayload(payload);

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(payloadText, { width: 280, margin: 1 }).then((value) => {
      if (active) {
        setQrImage(value);
      }
    });

    return () => {
      active = false;
    };
  }, [payloadText]);

  useEffect(() => {
    setSite(settings.siteName);
  }, [settings.siteName]);

  useEffect(() => {
    if (activeTab !== 'itemMaster' || !firebaseReady) {
      return;
    }

    void refreshItemMaster();
  }, [activeTab, firebaseReady]);

  async function refreshItemMaster() {
    setIsLoadingRecords(true);
    setImportError('');

    try {
      const itemMasterRecords = await listItemMasterRecords();
      setRecords(itemMasterRecords);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to load item master records.');
    } finally {
      setIsLoadingRecords(false);
    }
  }

  function loadPreset(index: number) {
    const preset = payloadPresets[index];
    setType(preset.type);
    setEntityId(preset.entityId);
    setCode(preset.code);
    setLabel(preset.label);
    setSite(preset.site);
    setMetadataText(metadataToText(preset.metadata));
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportStatus('');
    setImportError('');

    try {
      const parsed = await parseItemMasterFile(file);
      setImportFileName(parsed.fileName);
      setDetectedHeaders(parsed.detectedHeaders);
      setHeaderRowIndex(parsed.headerRowIndex);
      setPreviewRows(parsed.rows);
      setImportStatus(`Preview ready for ${parsed.rows.length} rows from ${parsed.sheetName}.`);
    } catch (error) {
      setPreviewRows([]);
      setDetectedHeaders({});
      setHeaderRowIndex(null);
      setImportError(error instanceof Error ? error.message : 'Unable to parse the uploaded workbook.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleSaveItemMaster() {
    if (!previewRows.length) {
      return;
    }

    setIsSaving(true);
    setImportStatus('');
    setImportError('');

    try {
      const saved = await saveItemMasterRecords(previewRows, currentUser);
      setImportStatus(`Saved ${saved} rows to Firestore itemMaster from ${importFileName || 'Item Availability.xlsx'}.`);
      await refreshItemMaster();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to save the item master rows.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport(format: 'xlsx' | 'csv') {
    setImportStatus('');
    setImportError('');

    try {
      const total = await exportItemMasterFile(format);
      setImportStatus(`Exported ${total} item master rows to ${format.toUpperCase()}.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to export item master.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Label Studio"
        title="QR Labels / Item Master"
        description="Generate QR label payloads, import Item Availability.xlsx as the first item master source, preview the rows, and save them to Firestore for fast verification lookups."
      />

      <div className="tab-row">
        <button
          className={`tab-button${activeTab === 'labels' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('labels')}
        >
          QR Labels
        </button>
        <button
          className={`tab-button${activeTab === 'itemMaster' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('itemMaster')}
        >
          Item Master
        </button>
      </div>

      {activeTab === 'labels' ? (
        <div className="split-layout">
          <SectionCard title="Payload builder" description="Edit the fields below to create new reusable QR content.">
            <div className="stack-form">
              <label>
                <span>QR Type</span>
                <select className="text-input" value={type} onChange={(event) => setType(event.target.value as QRType)}>
                  {payloadPresets.map((preset) => (
                    <option key={`${preset.type}-${preset.entityId}`} value={preset.type}>
                      {preset.type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Entity ID</span>
                <input className="text-input" value={entityId} onChange={(event) => setEntityId(event.target.value)} />
              </label>
              <label>
                <span>Code</span>
                <input className="text-input" value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
              <label>
                <span>Label</span>
                <input className="text-input" value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label>
                <span>Site</span>
                <input className="text-input" value={site} onChange={(event) => setSite(event.target.value)} />
              </label>
              <label>
                <span>Metadata</span>
                <textarea className="text-input" rows={6} value={metadataText} onChange={(event) => setMetadataText(event.target.value)} />
              </label>
              <div className="chip-grid">
                {payloadPresets.map((preset, index) => (
                  <button key={`${preset.type}-${preset.entityId}`} className="chip-button" type="button" onClick={() => loadPreset(index)}>
                    {preset.type}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Label preview"
            description="JSON payload, QR image, and print-friendly label block."
            actions={
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => printLabel(label, qrImage, payloadText, [`Type: ${type}`, `Entity: ${entityId}`, `Site: ${site}`])}
                >
                  Print Label
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    const scan = scanQr(payloadText, 'generator');
                    navigate(scan.workflowRoute);
                  }}
                >
                  Scan This Payload
                </button>
              </div>
            }
          >
            <div className="label-preview">
              {qrImage ? <img src={qrImage} alt={`${label} QR`} /> : null}
              <div>
                <strong>{label}</strong>
                <p>{entityId}</p>
              </div>
            </div>
            <div className="code-block">{payloadText}</div>
          </SectionCard>
        </div>
      ) : (
        <div className="page-stack">
          {!firebaseReady ? <div className="info-banner warning-banner">{firebaseError}</div> : null}

          <SectionCard title="Item Master Import" description="Upload Item Availability.xlsx, auto-detect the header row, preview the normalized rows, and save them into Firestore itemMaster.">
            <div className="stack-form">
              <label>
                <span>Upload Item Availability.xlsx</span>
                <input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} />
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
              {importStatus ? <div className="info-banner success-banner">{importStatus}</div> : null}
              {importError ? <div className="info-banner danger-banner">{importError}</div> : null}
              <div className="button-row">
                <button className="primary-button" type="button" disabled={!previewRows.length || !firebaseReady || isSaving} onClick={handleSaveItemMaster}>
                  {isSaving ? 'Saving…' : 'Save Item Availability to Item Master'}
                </button>
                <button className="secondary-button" type="button" disabled={!firebaseReady} onClick={() => handleExport('xlsx')}>
                  Export Item Master Excel
                </button>
                <button className="secondary-button" type="button" disabled={!firebaseReady} onClick={() => handleExport('csv')}>
                  Export Item Master CSV
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Import Preview" description="Review the normalized rows before anything is written to Firestore.">
            <DataTable
              rows={previewRows.slice(0, 50)}
              emptyMessage="Upload Item Availability.xlsx to preview the mapped item master rows."
              columns={[
                { key: 'row', label: 'Row', render: (row) => row.rowNumber },
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'description', label: 'Description', render: (row) => row.description },
                { key: 'availableQty', label: 'Available Qty', render: (row) => row.availableQty },
                { key: 'location', label: 'Location', render: (row) => row.defaultLocation || row.binLocation || '—' },
                { key: 'uom', label: 'UOM', render: (row) => row.uom || '—' },
                { key: 'category', label: 'Category', render: (row) => row.category || '—' },
              ]}
            />
            {previewRows.length > 50 ? <p className="hint-text">Showing the first 50 rows of {previewRows.length} preview rows.</p> : null}
          </SectionCard>

          <SectionCard
            title="Current Firestore Item Master"
            description="Latest itemMaster snapshot that downstream verification and inventory lookup use."
            actions={
              <button className="secondary-button" type="button" disabled={!firebaseReady || isLoadingRecords} onClick={() => void refreshItemMaster()}>
                {isLoadingRecords ? 'Refreshing…' : 'Refresh Snapshot'}
              </button>
            }
          >
            <DataTable
              rows={records.slice(0, 30)}
              emptyMessage={firebaseReady ? 'No Firestore item master rows loaded yet.' : 'Configure Firebase to load the Firestore snapshot.'}
              columns={[
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'description', label: 'Description', render: (row) => row.description },
                { key: 'availableQty', label: 'Available Qty', render: (row) => row.availableQty },
                { key: 'location', label: 'Default Location', render: (row) => row.defaultLocation || '—' },
                { key: 'bin', label: 'Bin', render: (row) => row.binLocation || '—' },
                { key: 'updatedBy', label: 'Updated By', render: (row) => row.updatedBy || '—' },
              ]}
            />
            {records.length > 30 ? <p className="hint-text">Showing the first 30 rows of {records.length} Firestore item master records.</p> : null}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
