import { crc32, deflateSync } from 'node:zlib';

const INK = [22, 33, 43, 255];
const MINT = [158, 246, 203, 255];
const CREAM = [248, 247, 235, 255];
const TRANSPARENT = [0, 0, 0, 0];

function chunk(type, data) {
  const major = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([major, data])));
  return Buffer.concat([length, major, data, checksum]);
}

function roundedRect(x, y, left, top, width, height, radius) {
  const offsetX = Math.abs(x - left - width / 2) - width / 2 + radius;
  const offsetY = Math.abs(y - top - height / 2) - height / 2 + radius;
  return Math.hypot(Math.max(offsetX, 0), Math.max(offsetY, 0)) +
    Math.min(Math.max(offsetX, offsetY), 0) < radius;
}

function strokeContains(x, y, startX, startY, endX, endY, radius) {
  const dx = endX - startX;
  const dy = endY - startY;
  const projection = ((x - startX) * dx + (y - startY) * dy) / (dx * dx + dy * dy);
  const along = Math.max(0, Math.min(1, projection));
  return Math.hypot(x - startX - along * dx, y - startY - along * dy) < radius;
}

function externalArrow(x, y, radius) {
  return strokeContains(x, y, 15, 18, 26, 7, radius) ||
    strokeContains(x, y, 19, 7, 26, 7, radius) ||
    strokeContains(x, y, 26, 7, 26, 14, radius);
}

function color(x, y) {
  if (!roundedRect(x, y, 0, 0, 32, 32, 7)) return TRANSPARENT;
  if (externalArrow(x, y, 1.75)) return MINT;
  if (externalArrow(x, y, 3.25)) return INK;
  if (!roundedRect(x, y, 4.5, 8.5, 19, 19, 3)) return INK;
  if (roundedRect(x, y, 11, 12, 9, 12, 1.25)) return INK;
  const perforation = [11, 16.5, 22].some((top) => roundedRect(x, y, 6.5, top, 2.5, 3, .6));
  return perforation ? INK : CREAM;
}

export function createIcon(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4 + 1;
  const data = Buffer.alloc(stride * size);
  const artworkSize = size === 128 ? 96 : size;
  const margin = (size - artworkSize) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgba = [0, 0, 0, 0];
      for (const dx of [.25, .75]) {
        for (const dy of [.25, .75]) {
          const point = color((x + dx - margin) * 32 / artworkSize, (y + dy - margin) * 32 / artworkSize);
          point.forEach((value, channel) => { rgba[channel] += value; });
        }
      }
      data.set(rgba.map((value) => Math.round(value / 4)), y * stride + 1 + x * 4);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(data)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
