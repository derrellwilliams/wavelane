/// The geometry behind remote navigation: given where focus is and where everything else is, which
/// item does an arrow press land on. Pure numbers, so it is tested without a browser.

export type Direction = "left" | "right" | "up" | "down";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/// How much more a sideways offset costs than distance straight ahead. High enough that the item
/// in the same row or column wins over a nearer one off to the side.
const SIDEWAYS_COST = 3;

/// Index of the box an arrow press moves to, or -1 when nothing lies that way.
export function pickNext(from: Box, boxes: readonly Box[], direction: Direction): number {
  const horizontal = direction === "left" || direction === "right";
  const forward = direction === "right" || direction === "down";

  let best = -1;
  let bestScore = Infinity;

  boxes.forEach((box, index) => {
    // Along the direction of travel: the candidate's near edge must be past our centre and its
    // centre past ours, so overlapping neighbours count but anything level or behind doesn't.
    const fromStart = horizontal ? from.left : from.top;
    const fromEnd = horizontal ? from.right : from.bottom;
    const boxStart = horizontal ? box.left : box.top;
    const boxEnd = horizontal ? box.right : box.bottom;
    const fromCentre = (fromStart + fromEnd) / 2;
    const boxCentre = (boxStart + boxEnd) / 2;

    const ahead = forward ? boxCentre > fromCentre && boxEnd > fromEnd : boxCentre < fromCentre && boxStart < fromStart;
    if (!ahead) return;
    const distance = Math.max(0, forward ? boxStart - fromEnd : fromStart - boxEnd);

    // Across it: no cost while the two overlap, otherwise the size of the gap between them.
    const fromLow = horizontal ? from.top : from.left;
    const fromHigh = horizontal ? from.bottom : from.right;
    const boxLow = horizontal ? box.top : box.left;
    const boxHigh = horizontal ? box.bottom : box.right;
    const sideways = Math.max(0, boxLow - fromHigh, fromLow - boxHigh);

    // Ties (two items that both overlap us) go to the one whose leading edge lines up best.
    const score = distance + sideways * SIDEWAYS_COST + Math.abs(boxLow - fromLow) / 1000;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });

  return best;
}
