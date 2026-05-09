import { useState } from 'react';
import type { EntitySummary, ScanRecord } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface WorkflowActionPanelProps {
  scan: ScanRecord;
  summary: EntitySummary | null;
  onStartTask: () => void;
  onCompleteTask: () => void;
  onReportIssue: () => void;
  onAddNotes: () => void;
  onPrintLabel: () => void;
  onViewHistory: () => void;
}

export default function WorkflowActionPanel({
  scan,
  summary,
  onStartTask,
  onCompleteTask,
  onReportIssue,
  onAddNotes,
  onPrintLabel,
  onViewHistory,
}: WorkflowActionPanelProps) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <section className="workflow-panel">
      <header className="workflow-panel-header">
        <div>
          <p className="eyebrow">Workflow Routing</p>
          <h3>{summary?.title ?? scan.displayValue}</h3>
          <p>{summary?.subtitle ?? scan.action}</p>
        </div>
        <StatusBadge status={summary?.status ?? scan.status} />
      </header>

      <div className="workflow-actions">
        <button className="secondary-button" type="button" onClick={() => setShowDetails((value) => !value)}>
          View Details
        </button>
        <button className="primary-button" type="button" onClick={onStartTask}>
          Start Task
        </button>
        <button className="primary-button" type="button" onClick={onCompleteTask}>
          Complete Task
        </button>
        <button className="secondary-button" type="button" onClick={onReportIssue}>
          Report Issue
        </button>
        <button className="secondary-button" type="button" onClick={onAddNotes}>
          Add Notes
        </button>
        <button className="secondary-button" type="button" onClick={onPrintLabel}>
          Print Label
        </button>
        <button className="secondary-button" type="button" onClick={onViewHistory}>
          View History
        </button>
      </div>

      {showDetails && summary ? (
        <dl className="detail-grid">
          {summary.details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
