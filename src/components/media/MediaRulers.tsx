interface MediaRulersProps {
  width: number;
  height: number;
  zoom: number;
  visible: boolean;
}

function ticks(size: number, step: number) {
  const values: number[] = [];
  for (let value = 0; value <= size; value += step) values.push(value);
  return values;
}

export function MediaRulers({ width, height, zoom, visible }: MediaRulersProps) {
  if (!visible) return null;
  const step = zoom < 0.3 ? 200 : zoom < 0.7 ? 100 : zoom < 1.5 ? 50 : 25;
  return (
    <>
      <div className="pointer-events-none absolute left-6 top-0 z-[10001] h-6 border-b border-white/10 bg-[#0b0f18]/95" style={{ width: width * zoom }}>
        {ticks(width, step).map(value => (
          <span key={value} className="absolute bottom-0 h-2 border-l border-white/30 text-[8px] text-slate-500" style={{ left: value * zoom }}>
            <span className="absolute bottom-2 left-1">{value}</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 top-6 z-[10001] w-6 border-r border-white/10 bg-[#0b0f18]/95" style={{ height: height * zoom }}>
        {ticks(height, step).map(value => (
          <span key={value} className="absolute right-0 w-2 border-t border-white/30 text-[8px] text-slate-500" style={{ top: value * zoom }}>
            <span className="absolute right-2 -top-1 origin-right -rotate-90">{value}</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 z-[10002] h-6 w-6 border-b border-r border-white/10 bg-[#0b0f18]" />
    </>
  );
}
