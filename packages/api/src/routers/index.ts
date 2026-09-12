import type { Database } from "@TripShare/db";
import {
	group,
	journey,
	journeyParticipant,
	payment,
	person,
} from "@TripShare/db/schema/tripshare";
import {
	calculateBalances,
	calculateFuelCost,
	directionSchema,
	isoDateSchema,
	paymentMethodSchema,
} from "@TripShare/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

const id = z.string().min(1);
const positive = z.number().positive();

async function ownedGroup(
	ctx: { db: Database; session: { user: { id: string } } },
	groupId: string,
) {
	const [record] = await ctx.db
		.select()
		.from(group)
		.where(and(eq(group.id, groupId), eq(group.ownerId, ctx.session.user.id)))
		.limit(1);
	if (!record)
		throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
	return record;
}

function extractPetrolPrice(payload: unknown): number | null {
	const candidates: number[] = [];
	const visit = (value: unknown, key = "") => {
		if (
			(typeof value === "number" || typeof value === "string") &&
			/petrol|price|rate/i.test(key)
		) {
			const candidate =
				typeof value === "number"
					? value
					: Number(value.replace(/[^0-9.]/g, ""));
			if (Number.isFinite(candidate)) candidates.push(candidate);
		} else if (Array.isArray(value))
			value.forEach((item) => {
				visit(item, key);
			});
		else if (value && typeof value === "object")
			Object.entries(value).forEach(([childKey, child]) => {
				visit(child, childKey);
			});
	};
	visit(payload);
	return candidates.find((value) => value > 50 && value < 300) ?? null;
}

export const groupRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select()
			.from(group)
			.where(eq(group.ownerId, ctx.session.user.id))
			.orderBy(desc(group.createdAt)),
	),
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().trim().min(2).max(80),
				vehicleName: z.string().trim().min(2).max(80),
				mileageKmpl: positive.max(100),
				normalOneWayKm: positive.max(2000),
				startDate: isoDateSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [created] = await ctx.db
				.insert(group)
				.values({
					id: crypto.randomUUID(),
					ownerId: ctx.session.user.id,
					name: input.name,
					vehicleName: input.vehicleName,
					mileageKmpl: String(input.mileageKmpl),
					normalOneWayKm: String(input.normalOneWayKm),
					startDate: input.startDate,
				})
				.returning();
			return created;
		}),
	detail: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(async ({ ctx, input }) => {
			const record = await ownedGroup(ctx, input.groupId);
			const [people, journeys, payments] = await Promise.all([
				ctx.db
					.select()
					.from(person)
					.where(eq(person.groupId, record.id))
					.orderBy(person.createdAt),
				ctx.db
					.select()
					.from(journey)
					.where(eq(journey.groupId, record.id))
					.orderBy(desc(journey.journeyDate), desc(journey.createdAt)),
				ctx.db
					.select()
					.from(payment)
					.where(eq(payment.groupId, record.id))
					.orderBy(desc(payment.paidOn), desc(payment.createdAt)),
			]);
			const journeyIds = journeys.map((item) => item.id);
			const participants = journeyIds.length
				? await ctx.db
						.select({
							journeyId: journeyParticipant.journeyId,
							personId: journeyParticipant.personId,
							sharePaise: journeyParticipant.sharePaise,
							name: person.name,
						})
						.from(journeyParticipant)
						.innerJoin(person, eq(person.id, journeyParticipant.personId))
						.where(inArray(journeyParticipant.journeyId, journeyIds))
				: [];
			return {
				group: record,
				people,
				journeys: journeys.map((item) => ({
					...item,
					participants: participants.filter(
						(participant) => participant.journeyId === item.id,
					),
				})),
				payments,
				balances: calculateBalances(participants, payments),
			};
		}),
});

export const peopleRouter = router({
	add: protectedProcedure
		.input(
			z.object({
				groupId: id,
				name: z.string().trim().min(2).max(80),
				phone: z.string().trim().max(30).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [created] = await ctx.db
				.insert(person)
				.values({
					id: crypto.randomUUID(),
					groupId: input.groupId,
					name: input.name,
					phone: input.phone || null,
				})
				.returning();
			return created;
		}),
	setActive: protectedProcedure
		.input(z.object({ groupId: id, personId: id, active: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [updated] = await ctx.db
				.update(person)
				.set({ isActive: input.active ? 1 : 0 })
				.where(
					and(eq(person.id, input.personId), eq(person.groupId, input.groupId)),
				)
				.returning();
			if (!updated)
				throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
			return updated;
		}),
});

export const fuelRouter = router({
	current: protectedProcedure.query(async ({ ctx }) => {
		if (!ctx.indianApiKey)
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					"IndianAPI key is not configured. Enter the petrol price manually.",
			});
		const url = new URL("https://fuel.indianapi.in/live_fuel_price");
		url.searchParams.set("location", "Udupi");
		url.searchParams.set("city", "Udupi");
		url.searchParams.set("state", "Karnataka");
		url.searchParams.set("fuel_type", "petrol");
		try {
			const response = await fetch(url, {
				headers: { "x-api-key": ctx.indianApiKey },
				cache: "no-store",
				signal: AbortSignal.timeout(8000),
			});
			if (!response.ok)
				throw new Error(`IndianAPI returned ${response.status}`);
			const priceRupees = extractPetrolPrice(await response.json());
			if (!priceRupees)
				throw new Error("No petrol price was present in the response");
			return {
				pricePaise: Math.round(priceRupees * 100),
				location: "Udupi, Karnataka" as const,
				source: "indianapi" as const,
				fetchedAt: new Date().toISOString(),
			};
		} catch (error) {
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: `Could not fetch Udupi petrol price: ${error instanceof Error ? error.message : "Unknown error"}. Enter it manually.`,
			});
		}
	}),
});

export const journeyRouter = router({
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				journeyDate: isoDateSchema,
				direction: directionSchema,
				distanceKm: positive.max(4000),
				participantIds: z.array(id).min(1),
				petrolPricePaise: z.number().int().positive(),
				petrolPriceSource: z.enum(["indianapi", "manual"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const record = await ownedGroup(ctx, input.groupId);
			if (input.journeyDate < record.startDate)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Journey date cannot be before ${record.startDate}`,
				});
			const uniqueIds = [...new Set(input.participantIds)];
			const validPeople = await ctx.db
				.select({ id: person.id })
				.from(person)
				.where(
					and(eq(person.groupId, input.groupId), inArray(person.id, uniqueIds)),
				);
			if (validPeople.length !== uniqueIds.length)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "One or more selected people are not in this group",
				});
			const mileageKmpl = Number(record.mileageKmpl);
			const costs = calculateFuelCost({
				distanceKm: input.distanceKm,
				mileageKmpl,
				petrolPricePaise: input.petrolPricePaise,
				participantCount: uniqueIds.length,
			});
			return ctx.db.transaction(async (tx) => {
				const journeyId = crypto.randomUUID();
				const [created] = await tx
					.insert(journey)
					.values({
						id: journeyId,
						groupId: input.groupId,
						journeyDate: input.journeyDate,
						direction: input.direction,
						distanceKm: String(input.distanceKm),
						mileageKmpl: String(mileageKmpl),
						petrolPricePaise: input.petrolPricePaise,
						petrolPriceSource: input.petrolPriceSource,
						fuelCostPaise: costs.fuelCostPaise,
						sharePaise: costs.sharePaise,
						participantCount: uniqueIds.length,
					})
					.returning();
				await tx.insert(journeyParticipant).values(
					uniqueIds.map((personId, index) => ({
						journeyId,
						personId,
						sharePaise:
							costs.sharePaise + (index < costs.remainderPaise ? 1 : 0),
					})),
				);
				return created;
			});
		}),
});

export const paymentRouter = router({
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				personId: id,
				amountPaise: z.number().int().positive(),
				method: paymentMethodSchema,
				paidOn: isoDateSchema,
				note: z.string().trim().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [member] = await ctx.db
				.select({ id: person.id })
				.from(person)
				.where(
					and(eq(person.id, input.personId), eq(person.groupId, input.groupId)),
				)
				.limit(1);
			if (!member)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Person is not in this group",
				});
			const [created] = await ctx.db
				.insert(payment)
				.values({
					id: crypto.randomUUID(),
					groupId: input.groupId,
					personId: input.personId,
					amountPaise: input.amountPaise,
					method: input.method,
					paidOn: input.paidOn,
					note: input.note || null,
				})
				.returning();
			return created;
		}),
});

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	groups: groupRouter,
	people: peopleRouter,
	fuel: fuelRouter,
	journeys: journeyRouter,
	payments: paymentRouter,
	dashboard: protectedProcedure.query(async ({ ctx }) => {
		const groups = await ctx.db
			.select()
			.from(group)
			.where(eq(group.ownerId, ctx.session.user.id));
		if (!groups.length)
			return {
				groupCount: 0,
				journeyCount: 0,
				totalOwedPaise: 0,
				totalPaidPaise: 0,
				recentJourneys: [],
			};
		const groupIds = groups.map((item) => item.id);
		const allJourneys = await ctx.db
			.select()
			.from(journey)
			.where(inArray(journey.groupId, groupIds))
			.orderBy(desc(journey.journeyDate));
		const [payments, owed] = await Promise.all([
			ctx.db
				.select({
					total: sql<number>`coalesce(sum(${payment.amountPaise}), 0)`,
				})
				.from(payment)
				.where(inArray(payment.groupId, groupIds)),
			ctx.db
				.select({
					total: sql<number>`coalesce(sum(${journeyParticipant.sharePaise}), 0)`,
				})
				.from(journeyParticipant)
				.innerJoin(journey, eq(journey.id, journeyParticipant.journeyId))
				.where(inArray(journey.groupId, groupIds)),
		]);
		return {
			groupCount: groups.length,
			journeyCount: allJourneys.length,
			totalOwedPaise: Number(owed[0]?.total ?? 0),
			totalPaidPaise: Number(payments[0]?.total ?? 0),
			recentJourneys: allJourneys.slice(0, 5),
		};
	}),
});

export type AppRouter = typeof appRouter;
