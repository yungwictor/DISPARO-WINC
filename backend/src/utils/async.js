export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomInt(min, max) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 1;
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : safeMin;
  const low = Math.max(1, Math.min(safeMin, safeMax));
  const high = Math.max(low, Math.max(safeMin, safeMax));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}
