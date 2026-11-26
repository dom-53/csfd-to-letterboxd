import { crc32, deflateSync } from 'node:zlib';

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

function color(x, y) {
  const ink = [22, 33, 43, 255];
  const mint = [158, 246, 203, 255];
  const cream = [248, 247, 235, 255];
  if (!roundedRect(x, y, 0, 0, 32, 32, 7)) return [0, 0, 0, 0];
  if (roundedRect(x, y, 13, 14, 7, 4, 1)) return mint;
  if (roundedRect(x, y, 17, 11, 10, 12, 2)) {
    return roundedRect(x, y, 20, 14, 4, 6, 1) ? ink : mint;
  }
  if (roundedRect(x, y, 5, 9, 10, 12, 2)) {
    return roundedRect(x, y, 8, 12, 4, 6, 1) ? ink : cream;
  }
  return ink;
}

export function createIcon(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4 + 1;
  const data = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgba = [0, 0, 0, 0];
      for (const dx of [.25, .75]) {
        for (const dy of [.25, .75]) {
          const point = color((x + dx) * 32 / size, (y + dy) * 32 / size);
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
