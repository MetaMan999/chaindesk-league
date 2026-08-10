export function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 116;
      const y = 48 - ((point - min) / Math.max(1, max - min)) * 40;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox="0 0 116 56" role="img" aria-label="Recent simulated price movement">
      <polyline points={coordinates} fill="none" stroke={positive ? "#75f0c1" : "#ff8298"} strokeWidth="2.5" />
    </svg>
  );
}

