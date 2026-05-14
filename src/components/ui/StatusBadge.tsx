interface StatusBadgeProps {
  status: string;
  toneOverride?: 'positive' | 'warning' | 'danger' | 'neutral' | 'info';
}

export default function StatusBadge({ status, toneOverride }: StatusBadgeProps) {
  const tone = status.toLowerCase();

  let modifier = toneOverride ?? 'neutral';
  if (!toneOverride) {
    if (
      tone.includes('correct') ||
      tone.includes('resolved') ||
      tone.includes('active') ||
      tone.includes('sent to inventory') ||
      tone.includes('picked') ||
      tone.includes('verified') ||
      tone.includes('pulled') ||
      tone.includes('found')
    ) {
      modifier = 'positive';
    } else if (tone.includes('progress') || tone.includes('queued') || tone.includes('pending') || tone.includes('logged')) {
      modifier = 'info';
    } else if (tone.includes('wrong') || tone.includes('short') || tone.includes('issue')) {
      modifier = 'danger';
    } else if (tone.includes('review') || tone.includes('recheck') || tone.includes('warning') || tone.includes('inactive')) {
      modifier = 'warning';
    }
  }

  return <span className={`status-badge status-${modifier}`}>{status}</span>;
}
