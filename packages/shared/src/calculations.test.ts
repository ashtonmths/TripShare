import assert from "node:assert/strict";
import test from "node:test";

import { calculateBalances, calculateFuelCost, isoDateSchema } from "./index";

test("calculates and splits fuel cost in paise", () => {
	assert.deepEqual(
		calculateFuelCost({
			distanceKm: 60,
			mileageKmpl: 15,
			petrolPricePaise: 10_250,
			participantCount: 3,
		}),
		{ fuelCostPaise: 41_000, sharePaise: 13_666, remainderPaise: 2 },
	);
});

test("calculates balances after partial payments", () => {
	assert.deepEqual(
		calculateBalances(
			[{ personId: "p1", sharePaise: 10_000 }],
			[{ personId: "p1", amountPaise: 3_000 }],
		),
		[
			{
				personId: "p1",
				owedPaise: 10_000,
				paidPaise: 3_000,
				balancePaise: 7_000,
			},
		],
	);
});

test("accepts real ISO calendar dates and rejects normalized dates", () => {
	assert.equal(isoDateSchema.safeParse("2026-02-28").success, true);
	assert.equal(isoDateSchema.safeParse("2026-02-31").success, false);
	assert.equal(isoDateSchema.safeParse("1999-12-31").success, false);
	assert.equal(isoDateSchema.safeParse("2101-01-01").success, false);
});
