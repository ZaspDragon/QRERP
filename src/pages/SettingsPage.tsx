import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';

export default function SettingsPage() {
  const { currentUser, employees, settings, updateSetting, resetDemoData } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Choose the active operator context for imports, scan verification, override control, and audit attribution."
      />

      <SectionCard title="Operator context" description="Choose the active demo user and site preferences.">
        <div className="stack-form">
          <label>
            <span>Active user</span>
            <select
              className="text-input"
              value={settings.activeUserId}
              onChange={(event) => updateSetting('activeUserId', event.target.value)}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Site name</span>
            <input
              className="text-input"
              value={settings.siteName}
              onChange={(event) => updateSetting('siteName', event.target.value)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.handheldMode}
              onChange={(event) => updateSetting('handheldMode', event.target.checked)}
            />
            <span>Handheld mode for larger controls</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.autoPrintLabels}
              onChange={(event) => updateSetting('autoPrintLabels', event.target.checked)}
            />
            <span>Auto-print labels after generation</span>
          </label>
          <div className="info-banner">
            Current user is <strong>{currentUser.name}</strong> ({currentUser.email}) with <strong>{currentUser.accessLevel}</strong> access.
          </div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={resetDemoData}>
              Reset Demo Data
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Verification Controls" description="This app now uses the active operator context for item-master imports, overrides, and pull confirmations.">
        <div className="code-block">
          1. Item master imports write updatedBy and updatedByEmail from the selected user.
          {'\n'}
          2. Lead/admin overrides require notes and inherit the selected user identity.
          {'\n'}
          3. Pull confirmations and scan verifications inherit the same operator attribution.
          {'\n'}
          4. Switch the active user here when testing picker versus lead/admin controls.
        </div>
      </SectionCard>
    </div>
  );
}
