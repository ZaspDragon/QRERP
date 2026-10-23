import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { downloadCsv } from '../lib/warehouse-store';

type ProductionRow = { employee: string; pulled: number; checked: number; putaway: number; pickedQty: number; workedHours: number };
const num = (value: unknown) => { const n = Number(String(value ?? '0').replace(/,/g,'')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const find = (r: Record<string,unknown>, aliases: string[]) => {
  const key = Object.keys(r).find(k=>aliases.includes(normalized(k)));
  return key ? r[key] : undefined;
};
function parseRows(data: Record<string,unknown>[]): ProductionRow[] {
  const totals = new Map<string,ProductionRow>();
  for(const row of data){
    const employee = String(find(row,['employee','employeename','name','worker','user','username','associate']) ?? '').trim();
    if(!employee || /^(total|grand total)$/i.test(employee)) continue;
    const pulled = num(find(row,['pulledlines','linespulled','pulled','pulls','pulledline']));
    const checked = num(find(row,['checkedlines','lineschecked','checked','checks','checkedline']));
    const putaway = num(find(row,['putawaylines','putaways','putaway']));
    const workedHours = num(find(row,['hours','workedhours','hoursworked']));
    const key=employee.toLowerCase(), current=totals.get(key)??{employee,pulled:0,checked:0,putaway:0,pickedQty:0,workedHours:0};
    current.pulled += pulled; current.checked += checked; current.putaway += putaway; current.workedHours += workedHours;
    totals.set(key,current);
  }
  return [...totals.values()].sort((a,b)=>(b.pulled+b.checked)-(a.pulled+a.checked));
}
export default function ProductionPage(){
  const {putAwayLogs,orderPickingSessions,cycleCountSessions,employees} = useERP();
  const [imported,setImported] = useState<ProductionRow[]>([]);
  const [filename,setFilename] = useState('');
  const [days,setDays] = useState(5);
  const [periodStart,setPeriodStart] = useState('');
  const [periodEnd,setPeriodEnd] = useState('');
  const [error,setError] = useState('');
  const [search,setSearch]=useState('');
  const inside = (date: string) => (!periodStart||date>=periodStart)&&(!periodEnd||date<=periodEnd);
  const records=useMemo(()=>{
    const totals=new Map<string,ProductionRow>();
    const add=(employee:string,field:'putaway'|'pulled'|'pickedQty',amount:number)=>{
      const name=employee.trim()||'Unknown';
      const key=name.toLowerCase(), current=totals.get(key)??{employee:name,pulled:0,checked:0,putaway:0,pickedQty:0,workedHours:0};
      current[field]+=amount;totals.set(key,current);
    };
    for(const item of putAwayLogs) if(inside(item.date)) add(item.worker,'putaway',item.lineCount);
    for(const item of orderPickingSessions) if(inside(item.date)){ add(item.picker,'pulled',item.lineCount);add(item.picker,'pickedQty',item.totalPicked); }
    const combined=new Map<string,ProductionRow>();
    for(const line of imported) combined.set(line.employee.toLowerCase(),{...line});
    for(const line of totals.values()){
      const key=line.employee.toLowerCase(), existing=combined.get(key);
      if(existing) { // Imported pulled and checked figures are authoritative; add only recorded putaways/picked quantity.
        existing.putaway+=line.putaway;existing.pickedQty+=line.pickedQty;
      } else combined.set(key,line);
    }
    return [...combined.values()].filter(r=>r.employee.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(b.pulled+b.checked+b.putaway)-(a.pulled+a.checked+a.putaway));
  },[imported,putAwayLogs,orderPickingSessions,periodStart,periodEnd,search]);
  const sums=records.reduce((x,r)=>({pulled:x.pulled+r.pulled,checked:x.checked+r.checked,putaway:x.putaway+r.putaway,pickedQty:x.pickedQty+r.pickedQty}),{pulled:0,checked:0,putaway:0,pickedQty:0});
  async function upload(file?:File){
    if(!file)return;
    setError('');
    try{
      if(file.size>8*1024*1024) throw new Error('File must be under 8 MB.');
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet)throw new Error('No spreadsheet sheet found.');
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''});
      const first=rows[0] ?? {};
      if(!Object.keys(first).some(k=>['employee','employeename','name','worker','user','username','associate'].includes(normalized(k))))throw new Error('Could not find an employee/name column. Expected headers: Employee, Pulled Lines, Checked Lines.');
      if(!Object.keys(first).some(k=>['pulledlines','linespulled','pulled','checkedlines','lineschecked','checked'].includes(normalized(k))))throw new Error('Could not find Pulled Lines or Checked Lines headers.');
      const parsed=parseRows(rows);
      if(!parsed.length)throw new Error('No employee production rows were found.');
      setImported(parsed);setFilename(file.name);
    }catch(e){setError(e instanceof Error?e.message:'Could not read file.');}
  }
  function exportReport(){
    downloadCsv(records.map(r=>({employee:r.employee,pulledLines:r.pulled,checkedLines:r.checked,putawayLines:r.putaway,pickedQty:r.pickedQty,workedHours:r.workedHours,pulledPerDay:(r.pulled/days).toFixed(2),checkedPerDay:(r.checked/days).toFixed(2),putawayPerDay:(r.putaway/days).toFixed(2)})), 'qrerp-production-report.csv');
  }
  return <div className="page-stack">
    <PageHeader eyebrow="Warehouse Labor" title="Production & Weekly Averages" description="Import employee Pulled Lines / Checked Lines from Excel or CSV and calculate weekly totals divided by the selected workdays. Recorded Firestore putaways and picking sessions are included separately." />
    <SectionCard title="Import production" description="Accepted headers: Employee (or Name), Pulled Lines, Checked Lines; optional Hours and Putaway Lines. Workbook first sheet only. Imports are temporary browser previews, not company-shared records.">
      <div className="inline-form-grid">
        <label><span>Excel or CSV</span><input className="text-input" type="file" accept=".xlsx,.xls,.csv" onChange={e=>void upload(e.target.files?.[0])}/></label>
        <label><span>Workdays in period</span><input className="text-input" type="number" min="1" max="31" value={days} onChange={e=>setDays(Math.max(1,Math.min(31,Number(e.target.value)||1)))}/></label>
        <label><span>From (saved sessions)</span><input className="text-input" type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></label>
        <label><span>To (saved sessions)</span><input className="text-input" type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></label>
      </div>
      <p className="hint-text">{filename ? 'Imported preview: '+filename : 'No spreadsheet uploaded yet.'} · {employees.length} employee roster entries · {cycleCountSessions.filter(s=>inside(s.date)).length} cycle count sessions (not counted as checked lines).</p>
      {error&&<div className="verification-banner danger">{error}</div>}
      <div className="button-row"><button className="secondary-button" onClick={exportReport} type="button">Export calculated CSV</button><button className="secondary-button" type="button" onClick={()=>{setImported([]);setFilename('');}}>Clear imported figures</button></div>
    </SectionCard>
    <section className="stat-grid">
      <div className="stat-card"><span className="stat-label">Pulled Lines</span><strong className="stat-value">{sums.pulled}</strong></div>
      <div className="stat-card"><span className="stat-label">Checked Lines</span><strong className="stat-value">{sums.checked}</strong></div>
      <div className="stat-card"><span className="stat-label">Putaway Lines</span><strong className="stat-value">{sums.putaway}</strong></div>
      <div className="stat-card"><span className="stat-label">Total Picked Qty</span><strong className="stat-value">{sums.pickedQty}</strong></div>
    </section>
    <SectionCard title="Employee production" description="Daily average is weekly lines ÷ workdays. Imported production is not summed again from pick sessions, preventing obvious double counts.">
      <label><span>Filter employee</span><input className="text-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee"/></label>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Pulled total</th><th>Checked total</th><th>Putaway total</th><th>Pulled / day</th><th>Checked / day</th><th>Putaway / day</th></tr></thead><tbody>
      {records.map(r=><tr key={r.employee}><td>{r.employee}</td><td>{r.pulled}</td><td>{r.checked}</td><td>{r.putaway}</td><td>{(r.pulled/days).toFixed(2)}</td><td>{(r.checked/days).toFixed(2)}</td><td>{(r.putaway/days).toFixed(2)}</td></tr>)}
      {!records.length&&<tr><td colSpan={7}>Upload a production workbook or record a putaway / picking session to see productivity.</td></tr>}
      </tbody></table></div>
    </SectionCard>
  </div>;
}
