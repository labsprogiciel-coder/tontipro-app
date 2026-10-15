// utils/csv-export.ts
import { File as FSFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Quote a CSV cell when it contains a separator, quote or newline. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/** Write the CSV to the cache directory and open the system share sheet. */
export async function shareCsv(
  filename: string,
  content: string,
  title: string,
) {
  const file = new FSFile(Paths.cache, filename);
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: title,
  });
}
