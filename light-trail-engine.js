const REFERENCES = [
  { mask: 1, vector: [1, 0, 0] },
  { mask: 2, vector: [0, 1, 0] },
  { mask: 4, vector: [0, 0, 1] },
  { mask: 5, vector: [1, 0, 1] },
  { mask: 3, vector: [1, 1, 0] },
  { mask: 6, vector: [0, 1, 1] }
];

const DISPLAY_COLORS = {
  0: [0, 0, 0], 1: [255, 0, 0], 2: [0, 255, 0], 3: [255, 255, 0],
  4: [0, 0, 255], 5: [255, 0, 255], 6: [0, 255, 255], 7: [255, 255, 255]
};

export function classifyPixel(r, g, b, { threshold = 160, strength = "normal" } = {}) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < threshold) return 0;
  const saturationFloor = { weak: 0.18, normal: 0.28, strong: 0.38 }[strength] ?? 0.28;
  if ((max - min) / max < saturationFloor) return 0;
  const normalized = [r / max, g / max, b / max];
  let bestMask = 0;
  let bestDistance = Infinity;
  for (const reference of REFERENCES) {
    const distance = Math.sqrt(reference.vector.reduce(
      (sum, value, index) => sum + (normalized[index] - value) ** 2, 0));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMask = reference.mask;
    }
  }
  const tolerance = { weak: 0.85, normal: 0.65, strong: 0.48 }[strength] ?? 0.65;
  return bestDistance <= tolerance ? bestMask : 0;
}

export function combineMasks(existingMask, incomingMask) {
  return existingMask | incomingMask;
}

export function maskToRgb(mask) {
  return DISPLAY_COLORS[mask] || DISPLAY_COLORS[0];
}

export function findComponents(masks, width, height, { minPixels = 10 } = {}) {
  const visited = new Uint8Array(masks.length);
  const components = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < masks.length; start += 1) {
    const mask = masks[start];
    if (!mask || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let totalX = 0, totalY = 0, count = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      totalX += x;
      totalY += y;
      count += 1;
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx, nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (!visited[next] && masks[next] === mask) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    if (count >= minPixels) components.push({ mask, x: totalX / count, y: totalY / count, count });
  }
  return components;
}

export function shouldConnect(previous, current, maxDistance) {
  if (!previous || !current || previous.mask !== current.mask) return false;
  return Math.hypot(previous.x - current.x, previous.y - current.y) <= maxDistance;
}

export function trailWidth(pixelCount) {
  return Math.max(4, Math.min(28, Math.round(Math.sqrt(pixelCount) * 1.8)));
}
