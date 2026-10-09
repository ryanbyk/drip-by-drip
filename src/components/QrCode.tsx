import { encode } from "uqr";

export function QrCode({ value }: { value: string }) {
  const grid = encode(value, { ecc: "M", border: 2 }).data;
  const size = grid.length;
  const cells: { x: number; y: number }[] = [];
  grid.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) cells.push({ x, y });
    });
  });
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Invite QR code">
      <rect className="qr-bg" width={size} height={size} />
      <g className="qr-ink">
        {cells.map((cell) => (
          <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={1} height={1} />
        ))}
      </g>
    </svg>
  );
}
