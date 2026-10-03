import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// One character is one logical pixel. Short rows are transparent on the right.
// # = black outline, o = white face, g = chrome-grey shade, . = transparent.
const cursors = {
  arrow: {
    hotspot: [0, 0],
    rows: [
      '#',
      '##',
      '#o#',
      '#oo#',
      '#ooo#',
      '#oooo#',
      '#ooooo#',
      '#oooooo#',
      '#ooooooo#',
      '#oooooooo#',
      '#ooooo#####',
      '#oo#oo#',
      '#o#.#oo#',
      '##..#oo#',
      '....#oo#',
      '.....#oo#',
      '.....#oo#',
      '......##',
    ],
  },
  hand: {
    hotspot: [9, 0],
    rows: [
      '.........##',
      '........#oo#',
      '........#oo#',
      '........#oo#',
      '........#oo#',
      '........#oo#',
      '........#oo#',
      '........#oo#',
      '........#oo#..##',
      '........#oo#.#oo#',
      '........#oo##oo#..##',
      '........#ooooo#.#oo#',
      '....##..#ooooo##oo#',
      '...#oo#.#ooooooooo#',
      '...#oo###ooooooooo#',
      '...#oooooooooooooo#',
      '....#ooooooooooooo#',
      '.....#oooooooooooo#',
      '......#ooooooooooo#',
      '.......#ooooooooo#',
      '........#oooooooo#',
      '........#oooooooo#',
      '........##########',
    ],
  },
  ibeam: {
    hotspot: [8, 11],
    rows: [
      '...###########',
      '...#ooooooooo#',
      '...#####o#####',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '.......#o#',
      '...#####o#####',
      '...#ooooooooo#',
      '...###########',
    ],
  },
  move: {
    hotspot: [10, 10],
    rows: [
      '..........#',
      '.........#o#',
      '........#ooo#',
      '.......#ooooo#',
      '......#########',
      '.........#o#',
      '.........#o#',
      '.........#o#',
      '....#....#o#....#',
      '...#o#...#o#...#o#',
      '#ooooo###ooo###ooooo#',
      '...#o#...#o#...#o#',
      '....#....#o#....#',
      '.........#o#',
      '.........#o#',
      '.........#o#',
      '......#########',
      '.......#ooooo#',
      '........#ooo#',
      '.........#o#',
      '..........#',
    ],
  },
  grabbing: {
    hotspot: [10, 9],
    rows: [
      '.......##..##',
      '......#oo##oo#',
      '......#oooooo#',
      '......#oooooo#..##',
      '......#oooooo#.#oo#',
      '......#oooooo##ooo#',
      '...##.#ooooooooooo#',
      '..#oo##ooooooooooo#',
      '..#ooooooooooooooo#',
      '..#ooooooooooooooo#',
      '...#oooooooooooooo#',
      '....#oooooooooooo#',
      '.....#ooooooooooo#',
      '......#oooooooooo#',
      '.......#oooooooo#',
      '.......#oooooooo#',
      '........##########',
    ],
  },
};

const colors = {
  '#': [0, 0, 0, 255],
  o: [255, 255, 255, 255],
  g: [141, 141, 147, 255],
  '.': [0, 0, 0, 0],
};
const fills = { '#': '#000000', o: '#ffffff', g: '#8d8d93' };

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function png(rows, scale) {
  const width = rows[0].length * scale;
  const height = rows.length * scale;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 4);
    for (let x = 0; x < width; x++) {
      const rgba = colors[rows[Math.floor(y / scale)][Math.floor(x / scale)]];
      for (let channel = 0; channel < 4; channel++) {
        raw[offset + 1 + x * 4 + channel] = rgba[channel];
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND'),
  ]);
}

function svg(rows) {
  const width = rows[0].length;
  const rects = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width;) {
      const color = rows[y][x];
      if (color === '.') { x++; continue; }
      let end = x + 1;
      while (end < width && rows[y][end] === color) end++;
      rects.push(`  <rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fills[color]}"/>`);
      x = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rows.length}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

const outputDir = fileURLToPath(new URL('../public/desk/cursors/', import.meta.url));
await mkdir(outputDir, { recursive: true });

for (const [name, cursor] of Object.entries(cursors)) {
  const width = Math.max(...cursor.rows.map((row) => row.length));
  const height = cursor.rows.length;
  const [hotX, hotY] = cursor.hotspot;
  if (width > 32 || height > 32 || hotX < 0 || hotY < 0 || hotX >= width || hotY >= height) {
    throw new Error(`${name}: invalid size or hotspot`);
  }
  if (cursor.rows.some((row) => [...row].some((pixel) => !(pixel in colors)))) {
    throw new Error(`${name}: unknown pixel character`);
  }
  const rows = cursor.rows.map((row) => row.padEnd(width, '.'));
  if (rows[hotY][hotX] === '.') throw new Error(`${name}: hotspot is transparent`);
  await writeFile(join(outputDir, `${name}.svg`), svg(rows));
  await writeFile(join(outputDir, `${name}.png`), png(rows, 1));
  await writeFile(join(outputDir, `${name}@2x.png`), png(rows, 2));
  console.log(`${name}: ${width}x${height}, hotspot ${hotX},${hotY}`);
}
