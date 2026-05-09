import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';

export default function SafetyPage() {
  const { safetyReports } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compliance"
        title="Safety"
        description="Track safety incidents, audit tasks, and mitigation work with the same scan history and action model as core operations."
      />

      <RouteWorkflowCard route="/safety" />

      <section className="stat-grid">
        <StatCard label="Open Items" value={`${safetyReports.filter((report) => report.status === 'Open').length}`} helper="Awaiting first action" />
        <StatCard label="Mitigation" value={`${safetyReports.filter((report) => report.status === 'Mitigation').length}`} helper="Corrective steps in motion" />
        <StatCard label="High Severity" value={`${safetyReports.filter((report) => report.severity === 'High').length}`} helper="Urgent safety focus" />
        <StatCard label="Scheduled Checks" value={`${safetyReports.filter((report) => report.status === 'Scheduled').length}`} helper="Upcoming compliance tasks" />
      </section>

      <SectionCard title="Safety queue" description="Safety QR scans land here for issue logging, notes, and closeout.">
        <DataTable
          rows={safetyReports}
          columns={[
            { key: 'id', label: 'Report', render: (row) => row.id },
            { key: 'title', label: 'Issue', render: (row) => row.title },
            { key: 'area', label: 'Area', render: (row) => row.area },
            { key: 'severity', label: 'Severity', render: (row) => row.severity },
            { key: 'updated', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
