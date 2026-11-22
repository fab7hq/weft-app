// Comma- or tab-separated text as rows of cells. A quoted cell may hold the
// separator, line breaks and doubled quotes; a quote inside an unquoted cell
// is a character like any other.

export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  // Whether anything of the current row was read: a last line break makes no empty row.
  let begun = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
    begun = false;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') {
      quoted = true;
      begun = true;
    } else if (c === sep) {
      endCell();
      begun = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += c;
      begun = true;
    }
  }
  if (begun || cell !== '' || row.length > 0) endRow();
  return rows;
}

/** The separator a file's name says: tabs for `.tsv` and `.tab`, else commas. */
export const separatorOf = (path: string): string => (/\.(tsv|tab)$/i.test(path) ? '\t' : ',');
