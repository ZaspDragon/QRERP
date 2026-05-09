import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CameraScanner from '../components/qr/CameraScanner';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { stringifyPayload } from '../utils/qr';

export default function ScannerPage() {
  const navigate = useNavigate();
  const { activeScan, payloadPresets, scanQr } = useERP();
  const [manualValue, setManualValue] = useState('ITEM:ITEM-1001');

  function handleScan(value: string, source: 'camera' | 'manual' | 'demo') {
    const scan = scanQr(value, source);
    navigate(scan.workflowRoute);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Scan Capture"
        title="QR scanner"
        description="Use the browser camera where supported, or fall back to manual entry for labels, handheld device testing, and training."
      />

      <SectionCard title="Camera scan" description="Designed for warehouse tablets and mobile browsers.">
        <CameraScanner onScan={(value) => handleScan(value, 'camera')} />
      </SectionCard>

      <SectionCard title="Manual entry fallback" description="Paste JSON payloads or use shorthand like ITEM:ITEM-1001.">
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleScan(manualValue, 'manual');
          }}
        >
          <textarea
            className="text-input"
            rows={6}
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
          />
          <div className="button-row">
            <button className="primary-button" type="submit">
              Submit Manual Scan
            </button>
            <button className="secondary-button" type="button" onClick={() => setManualValue('ITEM:ITEM-1001')}>
              Reset Sample
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Demo scan payloads" description="Tap any preset to test workflow routing end to end.">
        <div className="chip-grid">
          {payloadPresets.map((preset) => (
            <button
              key={`${preset.type}-${preset.entityId}`}
              className="chip-button"
              type="button"
              onClick={() => handleScan(stringifyPayload(preset), 'demo')}
            >
              {preset.type}: {preset.entityId}
            </button>
          ))}
        </div>
      </SectionCard>

      {activeScan ? (
        <SectionCard title="Most recent scan" description={`${activeScan.qrType} routed to ${activeScan.workflowRoute}.`}>
          <div className="scan-summary">
            <strong>{activeScan.displayValue}</strong>
            <span>{activeScan.action}</span>
          </div>
        </SectionCard>
      ) : null}

      <RouteWorkflowCard route={activeScan?.workflowRoute ?? '/scan-history'} />
    </div>
  );
}
