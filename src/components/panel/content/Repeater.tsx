/** Sıralanabilir tekrar eden alan listesi (paragraflar, sütunlar, adımlar, belgeler) */
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/panel/ui';

export function Repeater<T>({
  items, onChange, render, create, max, min = 0, addLabel, itemLabel, empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number, update: (v: T) => void) => ReactNode;
  create: () => T;
  max?: number;
  min?: number;
  addLabel: string;
  itemLabel: (i: number) => string;
  empty?: ReactNode;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.length === 0 && empty}
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-panel-line bg-panel-bg/40 p-4">
          <div className="mb-3 flex items-center gap-1">
            <span className="mr-auto text-[0.72rem] font-semibold tracking-[0.12em] text-panel-muted uppercase">{itemLabel(i)}</span>
            <IconButton label="Yukarı taşı" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Aşağı taşı" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </IconButton>
            {items.length > min && (
              <IconButton label="Kaldır" className="h-7 w-7 hover:text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </div>
          <div className="space-y-3">{render(item, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
        </div>
      ))}
      {(max === undefined || items.length < max) && (
        <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...items, create()])}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}
