import { useNavigate } from 'react-router-dom';
import { printScanLabel, useERP } from '../../context/ERPContext';
import WorkflowActionPanel from './WorkflowActionPanel';

interface RouteWorkflowCardProps {
  route: string;
}

export default function RouteWorkflowCard({ route }: RouteWorkflowCardProps) {
  const navigate = useNavigate();
  const { activeScan, getEntitySummary, startTaskForScan, completeTaskForScan, reportIssueForScan, addNotesToScan, getLabelPreview } = useERP();

  if (!activeScan || activeScan.workflowRoute !== route) {
    return null;
  }

  const summary = getEntitySummary(activeScan.id);

  return (
    <WorkflowActionPanel
      scan={activeScan}
      summary={summary}
      onStartTask={() => startTaskForScan(activeScan.id)}
      onCompleteTask={() => completeTaskForScan(activeScan.id)}
      onReportIssue={() => {
        const notes = window.prompt('Describe the issue for this workflow.', 'Needs supervisor review.');
        if (notes) {
          reportIssueForScan(activeScan.id, notes);
        }
      }}
      onAddNotes={() => {
        const notes = window.prompt('Add a workflow note.', '');
        if (notes) {
          addNotesToScan(activeScan.id, notes);
        }
      }}
      onPrintLabel={() => {
        void printScanLabel(getLabelPreview, activeScan.id);
      }}
      onViewHistory={() => navigate(`/scan-history?scan=${activeScan.id}`)}
    />
  );
}
