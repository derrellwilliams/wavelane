/// Which rows of a long grid need to exist. A library can hold thousands of posters; only the
/// rows on screen, a few either side, and the row with focus are ever in the page.

export interface Rows {
  first: number;
  /// Inclusive. Less than `first` when the grid is empty.
  last: number;
}

/// `top` is how far the grid's top edge has scrolled above the view's top (negative while the grid
/// starts lower down the page). `pitch` is one row plus the gap under it.
export function visibleRows(top: number, view: number, pitch: number, count: number, spare: number): Rows {
  if (count <= 0 || pitch <= 0) return { first: 0, last: -1 };
  const first = Math.floor(top / pitch) - spare;
  const last = Math.floor((top + view) / pitch) + spare;
  return { first: Math.min(count - 1, Math.max(0, first)), last: Math.min(count - 1, Math.max(0, last)) };
}

/// Widens `rows` so the focused row and its neighbours exist too: the row an arrow press lands on
/// must be there before the scroll that follows it.
export function withFocus(rows: Rows, focus: number, count: number, spare: number): Rows {
  if (rows.last < rows.first) return rows;
  const row = Math.min(count - 1, Math.max(0, focus));
  return { first: Math.max(0, Math.min(rows.first, row - spare)), last: Math.min(count - 1, Math.max(rows.last, row + spare)) };
}
