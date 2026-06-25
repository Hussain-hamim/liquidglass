/** Limit concurrent WebGL LiquidGlass instances to protect low-end GPUs. */
const MAX_CONCURRENT = 6;
let activeCount = 0;

export function acquireGlassSlot(): boolean {
  if (activeCount >= MAX_CONCURRENT) return false;
  activeCount += 1;
  return true;
}

export function releaseGlassSlot(): void {
  if (activeCount > 0) activeCount -= 1;
}

export function getActiveGlassCount(): number {
  return activeCount;
}
