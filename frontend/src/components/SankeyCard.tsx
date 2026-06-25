import React from 'react';
import type { SankeyResult, SankeyNodeGeo } from '../utils/sankey';

interface SankeyCardProps {
  title: string;
  subtitle?: string;
  /** Container height (px) */
  height: number;
  /** SVG viewBox width / height (design units) */
  viewW: number;
  viewH: number;
  data: SankeyResult;
}

const NodeLabel: React.FC<{ node: SankeyNodeGeo; align: 'left' | 'right' }> = ({ node, align }) => (
  <>
    <div
      className="absolute rounded-[3px]"
      style={{ left: node.bar.left, top: node.bar.top, width: node.bar.width, height: node.bar.height, background: node.color }}
    />
    <div
      className="absolute flex flex-col justify-center box-border"
      style={{
        left: node.labelBox.left,
        top: node.labelBox.top,
        width: node.labelBox.width,
        height: node.labelBox.height,
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        textAlign: align,
        paddingRight: align === 'right' ? '10px' : undefined,
        paddingLeft: align === 'left' ? '4px' : undefined,
      }}
    >
      <div className="text-[13px] font-bold text-dark leading-tight truncate max-w-full shrink-0">{node.label}</div>
      {node.sub && <div className="text-[11.5px] text-muted tabular-nums truncate max-w-full shrink-0">{node.sub}</div>}
    </div>
  </>
);

export const SankeyCard: React.FC<SankeyCardProps> = ({ title, subtitle, height, viewW, viewH, data }) => {
  return (
    <div className="bg-white rounded-[22px] p-[14px_18px] border border-inputBorder/20 shadow-sm mt-4">
      <div className="flex items-baseline gap-2.5 flex-wrap mb-2 px-2">
        <span className="text-[14px] font-bold text-dark">{title}</span>
        {subtitle && <span className="text-[12px] text-faint">{subtitle}</span>}
      </div>
      <div className="relative w-full mt-1" style={{ height }}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {data.ribbons.map((r, i) => (
            <path key={i} d={r.d} style={{ fill: r.fill, fillOpacity: 0.42, stroke: 'none' }} />
          ))}
        </svg>
        {data.left.map((n, i) => (
          <NodeLabel key={`l${i}`} node={n} align="right" />
        ))}
        {data.right.map((n, i) => (
          <NodeLabel key={`r${i}`} node={n} align="left" />
        ))}
      </div>
    </div>
  );
};
