import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { formatPercent } from '../utils/format';

export default function ReportsPage() {
  const { bins, cycleCounts, receivingLoads, equipment, orderPicks, scanHistory } = useERP();
  const occupancyAverage = Math.round(bins.reduce((sum, bin) => sum + bin.occupancy, 0) / bins.length);
  const countAccuracy = Math.round((cycleCounts.filter((task) => task.variance === 0).length / cycleCounts.length) * 100);
  const dockReadiness = Math.round((receivingLoads.filter((load) => load.status !== 'Blocked').length / receivingLoads.length) * 100);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Performance"
        title="Reports"
        description="Snapshot operational health across inventory, inbound readiness, picking demand, and equipment utilization."
      />

      <section className="stat-grid">
        <StatCard label="Bin Occupancy" value={formatPercent(occupancyAverage)} helper="Average storage occupancy across tracked bins" />
        <StatCard label="Count Accuracy" value={formatPercent(countAccuracy)} helper="Cycle counts with zero variance" />
        <StatCard label="Dock Readiness" value={formatPercent(dockReadiness)} helper="Inbound loads not currently blocked" />
        <StatCard label="Equipment Ready" value={formatPercent((equipment.filter((asset) => asset.status === 'Ready').length / equipment.length) * 100)} helper="Assets available for use" />
      </section>

      <div className="split-layout">
        <SectionCard title="Operational scorecard" description="Fast metrics for stand-ups and supervisor review.">
          <div className="report-stack">
            <div className="report-row">
              <span>Open receiving loads</span>
              <strong>{receivingLoads.filter((load) => load.status !== 'Received').length}</strong>
            </div>
            <div className="report-row">
              <span>Queued picks</span>
              <strong>{orderPicks.filter((task) => task.status === 'Queued').length}</strong>
            </div>
            <div className="report-row">
              <span>Scans logged today</span>
              <strong>{scanHistory.length}</strong>
            </div>
            <div className="report-row">
              <span>Bins above 90% occupancy</span>
              <strong>{bins.filter((bin) => bin.occupancy >= 90).length}</strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Count exceptions" description="Variance work needing attention.">
          <DataTable
            rows={cycleCounts.filter((task) => task.variance > 0)}
            emptyMessage="No count variances in the demo data."
            columns={[
              { key: 'task', label: 'Task', render: (row) => row.id },
              { key: 'zone', label: 'Zone', render: (row) => row.zone },
              { key: 'variance', label: 'Variance', render: (row) => row.variance },
              { key: 'assignee', label: 'Assignee', render: (row) => row.assignee },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}
