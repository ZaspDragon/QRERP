interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const tone = status.toLowerCase();

  let modifier = 'neutral';
  if (tone.includes('complete') || tone.includes('ready') || tone.includes('received') || tone.includes('resolved') || tone.includes('active') || tone.includes('clocked in') || tone.includes('stored')) {
    modifier = 'positive';
  } else if (tone.includes('progress') || tone.includes('loading') || tone.includes('mitigation') || tone.includes('staged') || tone.includes('planned')) {
    modifier = 'info';
  } else if (tone.includes('issue') || tone.includes('blocked') || tone.includes('hold') || tone.includes('investigate') || tone.includes('low stock') || tone.includes('tight')) {
    modifier = 'warning';
  }

  return <span className={`status-badge status-${modifier}`}>{status}</span>;
}
