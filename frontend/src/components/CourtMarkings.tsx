import type { CSSProperties } from 'react';

type MarkKind = 'line' | 'net' | 'box' | 'circle' | 'zone';
type Mark = { kind: MarkKind; x: number; y: number; width: number; height: number };

const line = (x: number, y: number, width: number, height = 0): Mark => ({ kind: 'line', x, y, width, height });
const net: Mark = { kind: 'net', x: 0, y: 50, width: 100, height: 0 };
const box = (x: number, y: number, width: number, height: number): Mark => ({ kind: 'box', x, y, width, height });
const circle = (x: number, y: number, width: number, height: number): Mark => ({ kind: 'circle', x, y, width, height });

const markingsBySport: Record<string, Mark[]> = {
  PICKLEBALL: [
    { kind: 'zone', x: 0, y: 34, width: 100, height: 32 },
    line(0, 34, 100), line(0, 66, 100), line(50, 0, 0, 34), line(50, 66, 0, 34), net,
  ],
  BADMINTON: [
    line(8, 0, 0, 100), line(92, 0, 0, 100), line(0, 6, 100), line(0, 94, 100),
    line(0, 35, 100), line(0, 65, 100), line(50, 0, 0, 35), line(50, 65, 0, 35), net,
  ],
  TENNIS: [
    line(12.5, 0, 0, 100), line(87.5, 0, 0, 100), line(12.5, 23, 75),
    line(12.5, 77, 75), line(50, 23, 0, 54), net,
  ],
  FOOTBALL: [
    line(0, 50, 100), circle(35, 41, 30, 18),
    box(20, 0, 60, 16), box(20, 84, 60, 16), box(36, 0, 28, 6), box(36, 94, 28, 6),
  ],
  BASKETBALL: [
    line(0, 50, 100), circle(38, 44, 24, 12),
    box(34, 0, 32, 21), box(34, 79, 32, 21),
    circle(38, 15, 24, 12), circle(38, 73, 24, 12),
  ],
};

export function CourtMarkings({ sportCode, landscape }: { sportCode?: string; landscape: boolean }) {
  return (
    <span className="court-drawing-markings" aria-hidden="true" data-sport={sportCode}>
      {(markingsBySport[sportCode ?? ''] ?? []).map((mark, index) => {
        const [left, top, width, height] = landscape
          ? [mark.y, mark.x, mark.height, mark.width]
          : [mark.x, mark.y, mark.width, mark.height];
        const style: CSSProperties = { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
        if (mark.kind === 'line' || mark.kind === 'net') {
          if (width === 0) style.borderLeftWidth = 1;
          else style.borderTopWidth = 1;
        }
        return <span key={index} className={`court-drawing-mark court-drawing-mark--${mark.kind}`} style={style} />;
      })}
    </span>
  );
}
