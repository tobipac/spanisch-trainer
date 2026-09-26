// Erzeugt die Platzhalter-App-Icons (PNG) ohne zusätzliche Abhängigkeiten.
// Motiv: weißer Ring (Tagesring) auf Akzentfarbe. Aufruf: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ACCENT: [number, number, number] = [0xd9, 0x48, 0x0f];
const WHITE: [number, number, number] = [0xff, 0xff, 0xff];
const SUPERSAMPLE = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** ringScale: Außenradius des Rings relativ zur halben Kantenlänge. */
function renderIcon(size: number, ringScale: number): Buffer {
  const c = size / 2;
  const outer = c * ringScale;
  const inner = outer * 0.62;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) / SUPERSAMPLE - c;
          const py = y + (sy + 0.5) / SUPERSAMPLE - c;
          const d = Math.hypot(px, py);
          if (d <= outer && d >= inner) hits++;
        }
      }
      const t = hits / (SUPERSAMPLE * SUPERSAMPLE);
      for (let i = 0; i < 3; i++) {
        raw[row + 1 + x * 3 + i] = Math.round(ACCENT[i]! * (1 - t) + WHITE[i]! * t);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
const icons: Array<[string, number, number]> = [
  ['icon-192.png', 192, 0.62],
  ['icon-512.png', 512, 0.62],
  ['icon-512-maskable.png', 512, 0.5], // Motiv innerhalb der sicheren Zone (80 %)
  ['apple-touch-icon.png', 180, 0.62],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, out), renderIcon(size, scale));
  console.log(`public/icons/${name} (${size}×${size})`);
}
