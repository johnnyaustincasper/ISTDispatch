import { PITCH_FACTORS, WALL_HEIGHTS } from "./constants.js";

export function calculateWallCountSqft(cavityCount, wallHeightIndex) {
  const count = parseInt(cavityCount, 10) || 0;
  const height = WALL_HEIGHTS[parseInt(wallHeightIndex, 10)];
  return count * (height ? height.sqftPer : 0);
}

export function calculateRectangleSqft(length, widthOrHeight) {
  return (parseFloat(length) || 0) * (parseFloat(widthOrHeight) || 0);
}

export function applyPitchFactor(sqft, pitch) {
  return (parseFloat(sqft) || 0) * (PITCH_FACTORS[pitch] || 1);
}

export function roundSqft(sqft) {
  return Math.round(parseFloat(sqft) || 0);
}
