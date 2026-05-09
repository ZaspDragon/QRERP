import { useNavigate } from 'react-router-dom';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { stringifyPayload } from '../utils/qr';

export default function QRFlowsPage() {
  const navigate = useNavigate();
  const { payloadPresets, scanQr } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workflow Map"
        title="QR code flows"
        description="Each QR type routes operators into the right module and exposes large action buttons for task execution, exception handling, and label printing."
      />

      <RouteWorkflowCard route="/inventory" />
      <RouteWorkflowCard route="/receiving" />
      <RouteWorkflowCard route="/putaway" />
      <RouteWorkflowCard route="/cycle-count" />
      <RouteWorkflowCard route="/order-picking" />
      <RouteWorkflowCard route="/equipment" />
      <RouteWorkflowCard route="/safety" />
      <RouteWorkflowCard route="/settings" />

      <div className="flow-grid">
        {payloadPresets.map((preset) => (
          <SectionCard
            key={`${preset.type}-${preset.entityId}`}
            title={preset.type}
            description={`${preset.label} routes to ${preset.workflow}.`}
            actions={
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  const scan = scanQr(stringifyPayload(preset), 'demo');
                  navigate(scan.workflowRoute);
                }}
              >
                Simulate Scan
              </button>
            }
          >
            <div className="code-block">{stringifyPayload(preset)}</div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
