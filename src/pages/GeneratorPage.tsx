import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { printLabel } from '../utils/printing';
import { buildPayload, stringifyPayload } from '../utils/qr';
import type { QRType } from '../types';

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
  const { payloadPresets, scanQr, settings } = useERP();
  const [qrImage, setQrImage] = useState('');
  const [type, setType] = useState<QRType>('ITEM');
  const [entityId, setEntityId] = useState('ITEM-1001');
  const [code, setCode] = useState('SKU-AX14');
  const [label, setLabel] = useState('Legends Safety Gloves');
  const [site, setSite] = useState(settings.siteName);
  const [metadataText, setMetadataText] = useState('bin: BIN-A1-01\npallet: PALLET-201');

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

  function loadPreset(index: number) {
    const preset = payloadPresets[index];
    setType(preset.type);
    setEntityId(preset.entityId);
    setCode(preset.code);
    setLabel(preset.label);
    setSite(preset.site);
    setMetadataText(metadataToText(preset.metadata));
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Label Studio"
        title="QR generator"
        description="Generate JSON payloads for items, bins, pallets, tasks, receiving loads, employees, and equipment, then preview and print warehouse labels."
      />

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
    </div>
  );
}
