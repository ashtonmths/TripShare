import { z } from "zod";

export const directionSchema = z.enum(["one_way", "two_way"]);
export const paymentMethodSchema = z.enum(["upi", "cash", "bank_transfer", "other"]);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export function calculateFuelCost(input: {
  distanceKm: number;
  mileageKmpl: number;
  petrolPricePaise: number;
  participantCount: number;
}) {
  if (input.distanceKm <= 0 || input.mileageKmpl <= 0 || input.petrolPricePaise <= 0) {
    throw new Error("Distance, mileage, and petrol price must be greater than zero");
  }
  if (!Number.isInteger(input.participantCount) || input.participantCount < 1) {
    throw new Error("At least one participant is required");
  }
  const fuelCostPaise = Math.round((input.distanceKm / input.mileageKmpl) * input.petrolPricePaise);
  const baseShare = Math.floor(fuelCostPaise / input.participantCount);
  const remainder = fuelCostPaise - baseShare * input.participantCount;
  return { fuelCostPaise, sharePaise: baseShare, remainderPaise: remainder };
}

export function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export type PersonBalance = { personId: string; owedPaise: number; paidPaise: number; balancePaise: number };

export function calculateBalances(
  shares: Array<{ personId: string; sharePaise: number }>,
  payments: Array<{ personId: string; amountPaise: number }>,
): PersonBalance[] {
  const totals = new Map<string, { owedPaise: number; paidPaise: number }>();
  for (const item of shares) {
    const current = totals.get(item.personId) ?? { owedPaise: 0, paidPaise: 0 };
    current.owedPaise += item.sharePaise;
    totals.set(item.personId, current);
  }
  for (const item of payments) {
    const current = totals.get(item.personId) ?? { owedPaise: 0, paidPaise: 0 };
    current.paidPaise += item.amountPaise;
    totals.set(item.personId, current);
  }
  return [...totals].map(([personId, total]) => ({
    personId,
    ...total,
    balancePaise: total.owedPaise - total.paidPaise,
  }));
}
