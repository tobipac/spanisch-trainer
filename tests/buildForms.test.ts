import { describe, expect, it } from 'vitest';
import { formatValue } from '../scripts/build-forms.ts';

describe('Formatierung der Wortpakete', () => {
  it('schreibt Einträge wie die bestehenden Pakete (Leerzeichen, Zahlen im Python-Format)', () => {
    expect(formatValue({ id: 'w1200', freqShare: 7.121e-5, deAlt: ['a', 'b'] })).toBe('{"id": "w1200", "freqShare": 7.121e-05, "deAlt": ["a", "b"]}');
    expect(formatValue(0.00030151)).toBe('0.00030151');
    expect(formatValue(0.0001)).toBe('0.0001');
    expect(formatValue('„ñ“')).toBe('"„ñ“"');
  });
});
