export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`;
}

export function formatCompactCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return count.toLocaleString('vi-VN');
}

export function formatSlotWindow(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

