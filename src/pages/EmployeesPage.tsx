import { useState } from 'react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { saveEmployee, setEmployeeActive } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';

export default function EmployeesPage() {
  const { currentUser, employees, isLeadOrAdmin } = useERP();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('picker');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function handleSaveEmployee() {
    if (!currentUser) {
      return;
    }

    if (!isLeadOrAdmin) {
      setError('Lead or admin access is required to add employees.');
      return;
    }

    if (!name.trim()) {
      setError('Employee name is required.');
      return;
    }

    setStatus('');
    setError('');
    setIsWorking(true);

    try {
      await saveEmployee(
        {
          name: name.trim(),
          email: email.trim(),
          role,
        },
        currentUser,
      );

      setName('');
      setEmail('');
      setRole('picker');
      setStatus('Employee saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the employee.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleToggleActive(employeeId: string, active: boolean) {
    if (!isLeadOrAdmin) {
      setError('Lead or admin access is required to update employees.');
      return;
    }

    setStatus('');
    setError('');

    try {
      await setEmployeeActive(employeeId, active);
      setStatus(active ? 'Employee activated.' : 'Employee deactivated.');
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update the employee.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="Preserve the Warehouse Ops employee roster inside the unified app, including role visibility and active/inactive status."
      />

      <SectionCard title="Add Employee" description="Leads and admins can maintain the warehouse roster here.">
        <div className="stack-form">
          <div className="inline-form-grid">
            <label>
              <span>Name</span>
              <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Taylor Jordan" />
            </label>
            <label>
              <span>Email</span>
              <input className="text-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="taylor@company.com" />
            </label>
            <label>
              <span>Role</span>
              <select className="text-input" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="picker">picker</option>
                <option value="counter">counter</option>
                <option value="inventory">inventory</option>
                <option value="lead">lead</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
          {status ? <div className="info-banner success-banner">{status}</div> : null}
          {error ? <div className="info-banner danger-banner">{error}</div> : null}
          <div className="button-row">
            <button className="primary-button" type="button" disabled={!currentUser || !isLeadOrAdmin || isWorking} onClick={() => void handleSaveEmployee()}>
              {isWorking ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Employee Roster" description="Active and inactive warehouse team members from Firestore.">
        <DataTable
          rows={employees}
          emptyMessage="No employees have been added yet."
          columns={[
            { key: 'name', label: 'Name', render: (row) => row.name },
            { key: 'email', label: 'Email', render: (row) => row.email || '—' },
            { key: 'role', label: 'Role', render: (row) => row.role || '—' },
            { key: 'active', label: 'Status', render: (row) => <StatusBadge status={row.active ? 'Active' : 'Inactive'} /> },
            { key: 'createdAt', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button
                  className="chip-button"
                  type="button"
                  disabled={!isLeadOrAdmin}
                  onClick={() => void handleToggleActive(row.id, !row.active)}
                >
                  {row.active ? 'Deactivate' : 'Activate'}
                </button>
              ),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
