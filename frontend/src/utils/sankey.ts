// Bipartite Sankey geometry — mirrors the design handoff algorithm.
// Ribbons are emitted in viewBox units (use inside an SVG with
// viewBox="0 0 SW SH" preserveAspectRatio="none"); node bars/labels are
// emitted as percentage box styles for absolutely-positioned divs.

export interface SankeySideNode {
  label: string;
  sub?: string;
  color: string;
  value: number;
}

export interface SankeyFlow {
  leftIndex: number;
  rightIndex: number;
  value: number;
}

export interface SankeyInput {
  left: SankeySideNode[];
  right: SankeySideNode[];
  flows: SankeyFlow[];
  SW: number;
  SH: number;
  LX: number;
  RX: number;
  NODEW?: number;
  GAP?: number;
  /** Minimum node height in viewBox units so tiny values stay legible */
  MINH?: number;
}

export interface SankeyBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

export interface SankeyNodeGeo {
  label: string;
  sub?: string;
  color: string;
  bar: SankeyBox;
  labelBox: SankeyBox;
}

export interface SankeyResult {
  ribbons: { d: string; fill: string }[];
  left: SankeyNodeGeo[];
  right: SankeyNodeGeo[];
}

// Distributes `avail` height across values proportionally, but no positive
// value renders below `minH` — clamped nodes take minH and the rest rescale
// into the remaining space. Zero/negative values get zero height.
function clampedHeights(values: number[], avail: number, minH: number): number[] {
  const positive = values.filter((v) => v > 0).length;
  if (positive === 0) return values.map(() => 0);
  const effMin = Math.min(minH, avail / positive);
  const clamped = values.map(() => false);
  for (;;) {
    const freeVal = values.reduce((s, v, i) => (v > 0 && !clamped[i] ? s + v : s), 0);
    const freeAvail = avail - clamped.filter(Boolean).length * effMin;
    const scale = freeVal > 0 ? freeAvail / freeVal : 0;
    let changed = false;
    values.forEach((v, i) => {
      if (v > 0 && !clamped[i] && v * scale < effMin) {
        clamped[i] = true;
        changed = true;
      }
    });
    if (!changed) {
      return values.map((v, i) => {
        if (v <= 0) return 0;
        return clamped[i] ? effMin : v * scale;
      });
    }
  }
}

export function computeSankey(input: SankeyInput): SankeyResult {
  const { left, right, flows, SW, SH } = input;
  const NODEW = input.NODEW ?? 13;
  const GAP = input.GAP ?? 14;
  const MINH = input.MINH ?? 30;
  const LX = input.LX;
  const RX = input.RX;

  const total = left.reduce((s, n) => s + n.value, 0);
  const ribbons: { d: string; fill: string }[] = [];
  const leftGeo: SankeyNodeGeo[] = [];
  const rightGeo: SankeyNodeGeo[] = [];

  if (total <= 0 || left.length === 0 || right.length === 0) {
    return { ribbons, left: leftGeo, right: rightGeo };
  }

  const PADDING_Y = 20;
  const availSH = SH - PADDING_Y * 2;
  const lH = clampedHeights(left.map((n) => n.value), availSH - GAP * (left.length - 1), MINH);
  const rH = clampedHeights(right.map((n) => n.value), availSH - GAP * (right.length - 1), MINH);

  const px = (v: number) => (v / SW) * 100 + '%';
  const py = (v: number) => (v / SH) * 100 + '%';

  // left node geometry (vertically centered block)
  const lTotalH = lH.reduce((s, h) => s + h, 0);
  let ly = (SH - (lTotalH + GAP * (left.length - 1))) / 2;
  const lTop: number[] = [];
  const lCursor: number[] = [];
  left.forEach((_, i) => {
    lTop.push(ly);
    lCursor.push(ly);
    ly += lH[i] + GAP;
  });

  // right node geometry
  const rTotalH = rH.reduce((s, h) => s + h, 0);
  let ry = (SH - (rTotalH + GAP * (right.length - 1))) / 2;
  const rTop: number[] = [];
  const rCursor: number[] = [];
  right.forEach((_, i) => {
    rTop.push(ry);
    rCursor.push(ry);
    ry += rH[i] + GAP;
  });

  // Ribbon end thicknesses are distributed within each node independently
  // (a ribbon may be thicker at a clamped end), with a small floor so no
  // segment renders as a hairline.
  const RIBBON_MINH = 1.5;
  const orderedFlows: { li: number; ri: number; value: number }[] = [];
  for (let li = 0; li < left.length; li++) {
    for (let ri = 0; ri < right.length; ri++) {
      const flow = flows.find((f) => f.leftIndex === li && f.rightIndex === ri);
      if (!flow || flow.value <= 0) continue;
      orderedFlows.push({ li, ri, value: flow.value });
    }
  }
  const endHeights = (side: 'li' | 'ri', index: number, nodeH: number) => {
    const segs = orderedFlows.filter((f) => f[side] === index);
    const heights = clampedHeights(segs.map((f) => f.value), nodeH, RIBBON_MINH);
    return new Map(segs.map((f, i) => [`${f.li}-${f.ri}`, heights[i]]));
  };
  const lEnd = left.map((_, i) => endHeights('li', i, lH[i]));
  const rEnd = right.map((_, i) => endHeights('ri', i, rH[i]));

  orderedFlows.forEach((f) => {
    const key = `${f.li}-${f.ri}`;
    const sh = lEnd[f.li].get(key) ?? 0;
    const th = rEnd[f.ri].get(key) ?? 0;
    const s0 = lCursor[f.li];
    const s1 = s0 + sh;
    const t0 = rCursor[f.ri];
    const t1 = t0 + th;
    lCursor[f.li] = s1;
    rCursor[f.ri] = t1;
    const x0 = LX + NODEW;
    const x1 = RX;
    const xc = (x0 + x1) / 2;
    const d =
      `M${x0},${s0} C${xc},${s0} ${xc},${t0} ${x1},${t0}` +
      ` L${x1},${t1} C${xc},${t1} ${xc},${s1} ${x0},${s1} Z`;
    ribbons.push({ d, fill: left[f.li].color });
  });

  // node boxes
  left.forEach((n, i) => {
    leftGeo.push({
      label: n.label,
      sub: n.sub,
      color: n.color,
      bar: { left: px(LX), top: py(lTop[i]), width: px(NODEW), height: py(lH[i]) },
      labelBox: { left: '0', top: py(lTop[i]), width: px(LX - 8), height: py(lH[i]) },
    });
  });
  right.forEach((n, i) => {
    rightGeo.push({
      label: n.label,
      sub: n.sub,
      color: n.color,
      bar: { left: px(RX), top: py(rTop[i]), width: px(NODEW), height: py(rH[i]) },
      labelBox: { left: px(RX + NODEW + 8), top: py(rTop[i]), width: px(SW - RX - NODEW - 8), height: py(rH[i]) },
    });
  });

  return { ribbons, left: leftGeo, right: rightGeo };
}
