import { useState } from 'react';
import type { DayValue } from '../domain/progress.ts';

interface Props {
  title: string;
  data: DayValue[];
  /** Kurzbeschriftung der x-Achse (nur an ausgewählten Stellen gezeigt). */
  axisLabel: (day: string) => string;
  /** Langform für Tooltip und Tabelle. */
  longLabel: (day: string) => string;
  unit: string;
  /** Welche Balken eine Achsenbeschriftung bekommen. */
  showAxisLabel: (index: number, count: number) => boolean;
  initialIndex?: number;
}

/**
 * Einfaches Balkendiagramm mit einer Datenreihe (Akzentfarbe, keine Legende nötig – der Titel benennt sie).
 * Schmale Balken mit 4-px-Rundung am Datenende, 2 px Abstand, zurückhaltende Achse.
 * Antippen/Hovern zeigt den Wert; eine Tabelle für Screenreader ist enthalten.
 */
export function BarChart({ title, data, axisLabel, longLabel, unit, showAxisLabel, initialIndex }: Props) {
  const [selected, setSelected] = useState(initialIndex ?? data.length - 1);
  const max = Math.max(1, ...data.map((d) => d.value));
  const sel = data[selected];

  return (
    <figure className="w-full">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-semibold">{title}</span>
        {sel && (
          <span className="text-sm text-neutral-600 dark:text-neutral-400" aria-live="polite">
            {longLabel(sel.day)}: <strong className="text-neutral-900 dark:text-neutral-100">{sel.value}</strong> {unit}
          </span>
        )}
      </figcaption>

      <div className="relative mt-3" aria-hidden="true">
        <span className="absolute -top-1 left-0 text-[10px] leading-none text-neutral-400">{max}</span>
        <div className="flex h-28 items-end gap-[2px] border-b border-neutral-300 pt-3 dark:border-neutral-700">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              tabIndex={-1}
              onClick={() => setSelected(i)}
              onPointerEnter={() => setSelected(i)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-opacity ${
                  i === selected ? 'bg-accent' : 'bg-accent opacity-60 group-hover:opacity-80'
                }`}
                style={{ height: d.value > 0 ? `max(3px, ${(d.value / max) * 100}%)` : '0' }}
              />
            </button>
          ))}
        </div>
        {data.length > 10 ? (
          // viele Balken: nur ausgewählte Beschriftungen, am Rand bündig, damit nichts abgeschnitten wird
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            {data
              .map((d, i) => (showAxisLabel(i, data.length) ? <span key={d.day}>{axisLabel(d.day)}</span> : null))
              .filter(Boolean)}
          </div>
        ) : (
          <div className="mt-1 flex gap-[2px]">
            {data.map((d, i) => (
              <span key={d.day} className="min-w-0 flex-1 text-center text-[10px] text-neutral-500">
                {showAxisLabel(i, data.length) ? axisLabel(d.day) : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{longLabel(d.day)}</th>
              <td>
                {d.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
