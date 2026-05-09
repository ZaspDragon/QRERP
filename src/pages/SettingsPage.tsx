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
        description="Keep the demo local today, then swap the data layer to Firebase later without changing the UI shell."
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
            Current user is <strong>{currentUser.name}</strong>, and all scans/actions are stored locally in this browser.
          </div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={resetDemoData}>
              Reset Demo Data
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Firebase-ready roadmap" description="Suggested next steps when you connect the real backend later.">
        <div className="code-block">
          1. Replace localStorage persistence with Firebase Auth and Firestore collections.
          {'\n'}
          2. Mirror scan history and workflow actions into user-scoped audit documents.
          {'\n'}
          3. Keep HashRouter or switch to a Pages-compatible SPA redirect strategy.
          {'\n'}
          4. Move demo seed data into import scripts so the UI stays unchanged.
        </div>
      </SectionCard>
    </div>
  );
}
