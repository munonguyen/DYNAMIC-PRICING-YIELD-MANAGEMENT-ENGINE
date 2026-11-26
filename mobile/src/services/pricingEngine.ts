export interface FactorSimulationInput {
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  demandOccupancyPct: number;
  timeWeight: number;
  leadHours: number;
}

export interface FactorSimulationOutput {
  rawPrice: number;
  clampedPrice: number;
  totalMultiplier: number;
  upliftPct: number;
}

export function simulateDynamicPrice(input: FactorSimulationInput): FactorSimulationOutput {
  const demandMultiplier = 0.88 + (input.demandOccupancyPct / 100) * 0.45;
  const leadMultiplier = input.leadHours <= 4 ? 1.12 : input.leadHours >= 48 ? 0.92 : 1.0;
  const totalMultiplier = Number(
    (demandMultiplier * input.timeWeight * leadMultiplier).toFixed(2)
  );
  const rawPrice = Math.round(input.basePrice * totalMultiplier);
  const clampedPrice = Math.min(input.maxPrice, Math.max(input.minPrice, rawPrice));
  const upliftPct = Number(
    (((clampedPrice - input.basePrice) / Math.max(1, input.basePrice)) * 100).toFixed(1)
  );

  return { rawPrice, clampedPrice, totalMultiplier, upliftPct };
}

