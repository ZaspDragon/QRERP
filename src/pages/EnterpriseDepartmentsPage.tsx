import { useMemo, useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

type Department = 'Sales' | 'Finance' | 'Purchasing' | 'Operations';
const scopes: Record<Department, string[]> = {
  Sales: ['Customer records and contacts','Quotes and sales orders','Customer price levels','Inventory availability before order release','Fulfillment and invoice status'],
  Finance: ['General ledger, AP and AR','Tax and payment reconciliation','Financial period controls','Auditable posting and approvals','Historical GP financial reports'],
  Purchasing: ['Vendors and item cost','Purchase orders and EDI','Inbound appointments and receiving','Short, over and damaged goods','Three-way invoice matching'],
  Operations: ['Putaway, replenishment and picking','Production by employee and branch','Downtime and labor metrics','Transfers, cycle counts and holds','Scanner, phone camera and label printing'],
};
export default function EnterpriseDepartmentsPage() {
  const [selected, setSelected] = useState<Department>('Sales');
  const items = useMemo(() => scopes[selected], [selected]);
  return <div className="page-stack">
    <PageHeader eyebrow="QRERP / Enterprise Departments" title="Company Operations" description="One destination for the Great Plains replacement program, keeping the existing QRERP navigation and warehouse design. These enterprise departments are a roadmap, not a live GP replacement." />
    <section className="stat-grid">
      {(['Sales','Finance','Purchasing','Operations'] as Department[]).map(name=><button key={name} className={'action-tile '+(selected===name?'enterprise-selected':'')} onClick={()=>setSelected(name)} type="button"><strong>{name}</strong><span>{scopes[name].length} planned capabilities</span></button>)}
    </section>
    <SectionCard title={selected+' capability map'} description="Requirements and acceptance criteria to implement before company-wide deployment.">
      <div className="report-stack">{items.map((item,index)=><div className="report-row" key={item}><strong>{String(index+1).padStart(2,'0')} · {item}</strong><span className="status-badge status-warning">Not yet integrated</span></div>)}</div>
    </SectionCard>
    <SectionCard title="Data migration safety" description="Do not import production GP customer, employee or financial data into a public repository or browser-only demo.">
      <p>Migration requires an authorized read-only source, a staging database, versioned mapping of GP records and reconciled totals. Finance and inventory posting must remain disabled until security and accounting tests pass.</p>
    </SectionCard>
  </div>;
}
