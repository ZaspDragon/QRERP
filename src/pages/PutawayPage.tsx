import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';

export default function PutawayPage() {
  const { putawayTasks } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Directed Storage"
        title="Putaway"
        description="Move inbound pallets into reserve or forward pick locations with large action buttons and destination visibility."
      />

      <RouteWorkflowCard route="/putaway" />

      <section className="stat-grid">
        <StatCard label="Queued Tasks" value={`${putawayTasks.filter((task) => task.status === 'Queued').length}`} helper="Waiting to be started" />
        <StatCard label="In Progress" value={`${putawayTasks.filter((task) => task.status === 'In Progress').length}`} helper="Operators currently moving stock" />
        <StatCard label="High Priority" value={`${putawayTasks.filter((task) => task.priority === 'High').length}`} helper="Urgent dock-clear tasks" />
        <StatCard label="Complete" value={`${putawayTasks.filter((task) => task.status === 'Complete').length}`} helper="Closed putaway work" />
      </section>

      <SectionCard title="Putaway queue" description="Scan a putaway task or pallet to route here automatically.">
        <DataTable
          rows={putawayTasks}
          columns={[
            { key: 'id', label: 'Task', render: (row) => row.id },
            { key: 'dock', label: 'From', render: (row) => row.fromDock },
            { key: 'bin', label: 'To Bin', render: (row) => row.toBin },
            { key: 'pallet', label: 'Pallet', render: (row) => row.palletId },
            { key: 'priority', label: 'Priority', render: (row) => row.priority },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
