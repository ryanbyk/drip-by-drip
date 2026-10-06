import type { Snapshot } from "../domain/types";

export function snapshotExport(snapshot: Snapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function exportFilename(today: string): string {
  return `drip-by-drip-${today}.json`;
}

export function downloadSnapshot(snapshot: Snapshot, today: string): void {
  const blob = new Blob([snapshotExport(snapshot)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename(today);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
