// Local only. Export files are untrusted: size-capped, parsed by hand, every field range-checked.

export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_FIELD = 300;

/// RFC 4180 reader (quoted fields, doubled quotes, CRLF or LF, BOM). Returns rows of strings.
export function readCsv(text: string): string[][] {
  if (text.length > MAX_BYTES) throw new Error("File too large");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field.slice(0, MAX_FIELD));
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.slice(0, MAX_FIELD));
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS) throw new Error("Too many rows");
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field.slice(0, MAX_FIELD));
    rows.push(row);
  }
  return rows;
}

/// Rows as objects keyed by the header line.
export function readTable(text: string): Record<string, string>[] {
  const [head, ...body] = readCsv(text);
  if (!head) return [];
  return body.map((cells) => Object.fromEntries(head.map((name, i) => [name, cells[i] ?? ""])));
}
