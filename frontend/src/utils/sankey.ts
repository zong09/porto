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

export function computeSankey(input: SankeyInput): SankeyResult {
  const { left, right, flows, SW, SH } = input;
  const NODEW = input.NODEW ?? 13;
  const GAP = input.GAP ?? 14;
  const LX = input.LX;
  const RX = input.RX;

  const total = left.reduce((s, n) => s + n.value, 0);
  const ribbons: { d: string; fill: string }[] = [];
  const leftGeo: SankeyNodeGeo[] = [];
  const rightGeo: SankeyNodeGeo[] = [];

  if (total <= 0 || left.length === 0 || right.length === 0) {
    return { ribbons, left: leftGeo, right: rightGeo };
  }

  const lScale = (SH - GAP * (left.length - 1)) / total;
  const rScale = (SH - GAP * (right.length - 1)) / total;
  const scale = Math.min(lScale, rScale);

  const px = (v: number) => (v / SW) * 100 + '%';
  const py = (v: number) => (v / SH) * 100 + '%';

  // left node geometry (vertically centered block)
  let ly = (SH - (total * scale + GAP * (left.length - 1))) / 2;
  const lTop: number[] = [];
  const lCursor: number[] = [];
  left.forEach((n) => {
    const h = n.value * scale;
    lTop.push(ly);
    lCursor.push(ly);
    ly += h + GAP;
  });

  // right node geometry
  let ry = (SH - (total * scale + GAP * (right.length - 1))) / 2;
  const rTop: number[] = [];
  const rCursor: number[] = [];
  right.forEach((n) => {
    const h = n.value * scale;
    rTop.push(ry);
    rCursor.push(ry);
    ry += h + GAP;
  });

  // ribbons: per left node, per right node (in right order)
  for (let li = 0; li < left.length; li++) {
    for (let ri = 0; ri < right.length; ri++) {
      const flow = flows.find((f) => f.leftIndex === li && f.rightIndex === ri);
      if (!flow || flow.value <= 0) continue;
      const fh = flow.value * scale;
      const s0 = lCursor[li];
      const s1 = s0 + fh;
      const t0 = rCursor[ri];
      const t1 = t0 + fh;
      lCursor[li] = s1;
      rCursor[ri] = t1;
      const x0 = LX + NODEW;
      const x1 = RX;
      const xc = (x0 + x1) / 2;
      const d =
        `M${x0},${s0} C${xc},${s0} ${xc},${t0} ${x1},${t0}` +
        ` L${x1},${t1} C${xc},${t1} ${xc},${s1} ${x0},${s1} Z`;
      ribbons.push({ d, fill: left[li].color });
    }
  }

  // node boxes
  left.forEach((n, i) => {
    const h = n.value * scale;
    leftGeo.push({
      label: n.label,
      sub: n.sub,
      color: n.color,
      bar: { left: px(LX), top: py(lTop[i]), width: px(NODEW), height: py(h) },
      labelBox: { left: '0', top: py(lTop[i]), width: px(LX - 8), height: py(h) },
    });
  });
  right.forEach((n, i) => {
    const h = n.value * scale;
    rightGeo.push({
      label: n.label,
      sub: n.sub,
      color: n.color,
      bar: { left: px(RX), top: py(rTop[i]), width: px(NODEW), height: py(h) },
      labelBox: { left: px(RX + NODEW + 8), top: py(rTop[i]), width: px(SW - RX - NODEW - 8), height: py(h) },
    });
  });

  return { ribbons, left: leftGeo, right: rightGeo };
}
