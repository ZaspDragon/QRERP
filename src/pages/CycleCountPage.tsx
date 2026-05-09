import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';

export default function CycleCountPage() {
  const { cycleCounts } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventory Accuracy"
        title="Cycle count"
        description="Use route-driven count scans to start counts, record variances, and close out reconciliation work."
      />

      <RouteWorkflowCard route="/cycle-count" />

      <section className="stat-grid">
        <StatCard label="Planned Counts" value={`${cycleCounts.filter((task) => task.status === 'Planned').length}`} helper="Ready to launch" />
        <StatCard label="Investigations" value={`${cycleCounts.filter((task) => task.status === 'Investigate').length}`} helper="Variance requiring review" />
        <StatCard label="In Progress" value={`${cycleCounts.filter((task) => task.status === 'In Progress').length}`} helper="Counts underway right now" />
        <StatCard label="Zero Variance" value={`${cycleCounts.filter((task) => task.variance === 0).length}`} helper="Tasks with no discrepancies" />
      </section>

      <SectionCard title="Count schedule" description="Large touch targets make this usable on counting tablets.">
        <DataTable
          rows={cycleCounts}
          columns={[
            { key: 'id', label: 'Task', render: (row) => row.id },
            { key: 'zone', label: 'Zone', render: (row) => row.zone },
            { key: 'scheduled', label: 'Scheduled', render: (row) => formatDateTime(row.scheduledFor) },
            { key: 'variance', label: 'Variance', render: (row) => row.variance },
            { key: 'assignee', label: 'Assignee', render: (row) => row.assignee },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
