import type { Database } from "@TripShare/db";
import { user } from "@TripShare/db/schema/auth";
import {
	appRelease,
	correctionRequest,
	group,
	journey,
	journeyParticipant,
	payment,
	paymentClaim,
	person,
} from "@TripShare/db/schema/tripshare";
import {
	allocateWeightedShares,
	calculateBalances,
	calculateFuelCost,
	directionSchema,
	isoDateSchema,
	paymentMethodSchema,
} from "@TripShare/shared";
import { timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../index";

const id = z.string().uuid();
const positive = z.number().finite().positive();
const MAX_PETROL_PRICE_PAISE = 50_000;
const MAX_PAYMENT_PAISE = 100_000_000;
const MAX_PARTICIPANTS = 100;
const email = z.string().trim().toLowerCase().email().max(254);
const fuelTypeSchema = z.enum(["petrol", "diesel"]);

function stripHtml(value: string) {
	return value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&#8377;|&#x20b9;/gi, "₹")
		.replace(/&amp;/gi, "&")
		.replace(/\s+/g, " ");
}

async function fetchFuelPage(path: string) {
	const response = await fetch(`https://www.mypetrolprice.com${path}`, {
		headers: {
			Accept: "text/html,application/xhtml+xml",
			"User-Agent":
				"Mozilla/5.0 (compatible; TripShare/1.0; +https://tripshare.ashtonmths.dev)",
		},
		cache: "no-store",
		signal: AbortSignal.timeout(8000),
	});
	if (!response.ok) throw new Error(`price site returned ${response.status}`);
	return response.text();
}

function parseLinks(html: string, pattern: RegExp) {
	const result: { id: number; name: string; slug: string }[] = [];
	for (const match of html.matchAll(pattern)) {
		const id = Number(match[1]);
		const slug = match[2] ?? "";
		const name = stripHtml(match[3] ?? "").trim();
		if (
			Number.isInteger(id) &&
			id > 0 &&
			name &&
			!result.some((x) => x.id === id)
		)
			result.push({ id, name, slug });
	}
	return result.sort((a, b) => a.name.localeCompare(b.name));
}

function encodeBase64Url(value: string | ArrayBuffer) {
	const bytes =
		typeof value === "string"
			? new TextEncoder().encode(value)
			: new Uint8Array(value);
	return Buffer.from(bytes).toString("base64url");
}

async function signFuelQuote(secret: string, payload: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return encodeBase64Url(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
	);
}

async function createFuelQuote(
	secret: string,
	userId: string,
	groupId: string,
	pricePaise: number,
) {
	const payload = encodeBase64Url(
		JSON.stringify({
			userId,
			groupId,
			pricePaise,
			expiresAt: Date.now() + 10 * 60_000,
		}),
	);
	return `${payload}.${await signFuelQuote(secret, payload)}`;
}

async function verifyFuelQuote(
	secret: string,
	token: string,
	userId: string,
	groupId: string,
	pricePaise: number,
) {
	const [payload, signature, extra] = token.split(".");
	if (!payload || !signature || extra) return false;
	const expected = await signFuelQuote(secret, payload);
	if (signature.length !== expected.length) return false;
	const left = Buffer.from(signature);
	const right = Buffer.from(expected);
	if (!timingSafeEqual(left, right)) return false;
	try {
		const value = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		);
		return (
			value.userId === userId &&
			value.groupId === groupId &&
			value.pricePaise === pricePaise &&
			typeof value.expiresAt === "number" &&
			value.expiresAt >= Date.now()
		);
	} catch {
		return false;
	}
}

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
				fuelType: fuelTypeSchema.default("petrol"),
				fuelState: z.string().trim().min(2).max(80).default("Karnataka"),
				fuelDistrict: z.string().trim().min(2).max(80).default("Udupi"),
				fuelLocationId: z.number().int().positive().max(100_000).default(383),
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
					fuelType: input.fuelType,
					fuelState: input.fuelState,
					fuelDistrict: input.fuelDistrict,
					fuelLocationId: input.fuelLocationId,
				})
				.returning();
			return created;
		}),
	updateSettings: protectedProcedure
		.input(
			z.object({
				groupId: id,
				mileageKmpl: positive.max(100),
				normalOneWayKm: positive.max(2000),
				fuelType: fuelTypeSchema,
				fuelState: z.string().trim().min(2).max(80),
				fuelDistrict: z.string().trim().min(2).max(80),
				fuelLocationId: z.number().int().positive().max(100_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [updated] = await ctx.db
				.update(group)
				.set({
					mileageKmpl: String(input.mileageKmpl),
					normalOneWayKm: String(input.normalOneWayKm),
					fuelType: input.fuelType,
					fuelState: input.fuelState,
					fuelDistrict: input.fuelDistrict,
					fuelLocationId: input.fuelLocationId,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(group.id, input.groupId),
						eq(group.ownerId, ctx.session.user.id),
					),
				)
				.returning();
			return updated;
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
			const corrections = await ctx.db
				.select({
					id: correctionRequest.id,
					journeyId: correctionRequest.journeyId,
					personId: correctionRequest.personId,
					personName: person.name,
					note: correctionRequest.note,
					status: correctionRequest.status,
					createdAt: correctionRequest.createdAt,
				})
				.from(correctionRequest)
				.innerJoin(person, eq(person.id, correctionRequest.personId))
				.where(eq(person.groupId, record.id))
				.orderBy(desc(correctionRequest.createdAt));
			const paymentClaims = await ctx.db
				.select({
					id: paymentClaim.id,
					personId: paymentClaim.personId,
					personName: person.name,
					amountPaise: paymentClaim.amountPaise,
					method: paymentClaim.method,
					paidOn: paymentClaim.paidOn,
					note: paymentClaim.note,
					status: paymentClaim.status,
					createdAt: paymentClaim.createdAt,
				})
				.from(paymentClaim)
				.innerJoin(person, eq(person.id, paymentClaim.personId))
				.where(eq(paymentClaim.groupId, record.id))
				.orderBy(desc(paymentClaim.createdAt));
			const journeyIds = journeys.map((item) => item.id);
			const participants = journeyIds.length
				? await ctx.db
						.select({
							journeyId: journeyParticipant.journeyId,
							personId: journeyParticipant.personId,
							sharePaise: journeyParticipant.sharePaise,
							direction: journeyParticipant.direction,
							name: person.name,
						})
						.from(journeyParticipant)
						.innerJoin(
							person,
							and(
								eq(person.id, journeyParticipant.personId),
								eq(person.groupId, record.id),
							),
						)
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
				corrections,
				paymentClaims,
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
				email: email.optional().or(z.literal("")),
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
					email: input.email || null,
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
	updateContact: protectedProcedure
		.input(
			z.object({
				groupId: id,
				personId: id,
				name: z.string().trim().min(2).max(80),
				email: email.optional().or(z.literal("")),
				phone: z.string().trim().max(30).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [updated] = await ctx.db
				.update(person)
				.set({
					name: input.name,
					email: input.email || null,
					phone: input.phone || null,
				})
				.where(
					and(eq(person.id, input.personId), eq(person.groupId, input.groupId)),
				)
				.returning();
			if (!updated)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Partner not found",
				});
			return updated;
		}),
});

export const fuelRouter = router({
	states: protectedProcedure.query(async () => {
		try {
			const html = await fetchFuelPage("/");
			return parseLinks(
				html,
				/href=["'](?:https:\/\/www\.mypetrolprice\.com)?\/(\d+)\/Fuel-Prices-in-([^"']+)["'][^>]*>([^<]+)<\/a>/gi,
			);
		} catch (error) {
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: `Could not load states: ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		}
	}),
	districts: protectedProcedure
		.input(
			z.object({
				stateId: z.number().int().min(1).max(100),
				stateSlug: z
					.string()
					.regex(/^[A-Za-z0-9_-]+$/)
					.max(100),
			}),
		)
		.query(async ({ input }) => {
			try {
				const html = await fetchFuelPage(
					`/${input.stateId}/Fuel-Prices-in-${input.stateSlug}`,
				);
				return parseLinks(
					html,
					/href=["'](?:https:\/\/www\.mypetrolprice\.com)?\/(\d+)\/Fuel-prices-in-([^"']+)["'][^>]*>([^<]+)<\/a>/gi,
				);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_GATEWAY",
					message: `Could not load districts: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}),
	current: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(async ({ ctx, input }) => {
			const record = await ownedGroup(ctx, input.groupId);
			try {
				const slug = record.fuelDistrict.replace(/[^A-Za-z0-9]+/g, "-");
				const html = await fetchFuelPage(
					`/${record.fuelLocationId}/Fuel-prices-in-${slug}`,
				);
				const text = stripHtml(html);
				const label = record.fuelType === "petrol" ? "Petrol" : "Diesel";
				const match = text.match(
					new RegExp(
						`₹\\s*([0-9]+(?:\\.[0-9]+)?)\\s*per litre for ${label}`,
						"i",
					),
				);
				const priceRupees = match?.[1] ? Number(match[1]) : null;
				if (!priceRupees || priceRupees < 50 || priceRupees > 300)
					throw new Error(`No valid ${record.fuelType} price was found`);
				const pricePaise = Math.round(priceRupees * 100);
				return {
					pricePaise,
					location: `${record.fuelDistrict}, ${record.fuelState}`,
					fuelType: record.fuelType,
					source: "mypetrolprice" as const,
					fetchedAt: new Date().toISOString(),
					quoteToken: await createFuelQuote(
						ctx.fuelQuoteSecret,
						ctx.session.user.id,
						record.id,
						pricePaise,
					),
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_GATEWAY",
					message: `Could not fetch the current ${record.fuelType} price for ${record.fuelDistrict}: ${error instanceof Error ? error.message : "Unknown error"}. Enter it manually.`,
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
				participantIds: z.array(id).min(1).max(MAX_PARTICIPANTS),
				participantDirections: z
					.array(z.object({ personId: id, direction: directionSchema }))
					.max(MAX_PARTICIPANTS)
					.optional(),
				petrolPricePaise: z
					.number()
					.int()
					.positive()
					.max(MAX_PETROL_PRICE_PAISE),
				petrolPriceSource: z.enum(["mypetrolprice", "manual"]),
				fuelQuoteToken: z.string().max(1024).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const record = await ownedGroup(ctx, input.groupId);
			if (
				input.petrolPriceSource === "mypetrolprice" &&
				(!input.fuelQuoteToken ||
					!(await verifyFuelQuote(
						ctx.fuelQuoteSecret,
						input.fuelQuoteToken,
						ctx.session.user.id,
						input.groupId,
						input.petrolPricePaise,
					)))
			)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Fuel quote is invalid or expired. Fetch the price again.",
				});
			if (input.journeyDate < record.startDate)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Journey date cannot be before ${record.startDate}`,
				});
			const uniqueIds = [...new Set(input.participantIds)];
			const directionByPerson = new Map(
				input.participantDirections?.map((item) => [
					item.personId,
					item.direction,
				]),
			);
			if (
				[...directionByPerson.keys()].some(
					(personId) => !uniqueIds.includes(personId),
				)
			)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Participant directions must belong to selected people",
				});
			const validPeople = await ctx.db
				.select({ id: person.id })
				.from(person)
				.where(
					and(
						eq(person.groupId, input.groupId),
						eq(person.isActive, 1),
						inArray(person.id, uniqueIds),
					),
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
			const shares = allocateWeightedShares(
				costs.fuelCostPaise,
				uniqueIds.map((personId) => ({
					id: personId,
					weight:
						(directionByPerson.get(personId) ?? input.direction) === "two_way"
							? 2
							: 1,
				})),
			);
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
					uniqueIds.map((personId) => ({
						journeyId,
						personId,
						direction: directionByPerson.get(personId) ?? input.direction,
						sharePaise:
							shares.find((share) => share.id === personId)?.sharePaise ?? 0,
					})),
				);
				return created;
			});
		}),
	updateParticipantDirection: protectedProcedure
		.input(
			z.object({
				journeyId: id,
				personId: id,
				direction: directionSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [record] = await ctx.db
				.select({
					id: journey.id,
					groupId: journey.groupId,
					fuelCostPaise: journey.fuelCostPaise,
					direction: journey.direction,
				})
				.from(journey)
				.innerJoin(group, eq(group.id, journey.groupId))
				.where(
					and(
						eq(journey.id, input.journeyId),
						eq(group.ownerId, ctx.session.user.id),
					),
				)
				.limit(1);
			if (!record)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Journey not found",
				});
			if (record.direction === "one_way" && input.direction === "two_way")
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A one-way journey cannot contain a return passenger",
				});
			const participants = await ctx.db
				.select({
					personId: journeyParticipant.personId,
					direction: journeyParticipant.direction,
				})
				.from(journeyParticipant)
				.where(eq(journeyParticipant.journeyId, record.id));
			if (!participants.some((item) => item.personId === input.personId))
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Participant not found",
				});
			const updated = participants.map((item) => ({
				id: item.personId,
				direction:
					item.personId === input.personId ? input.direction : item.direction,
				weight:
					(item.personId === input.personId
						? input.direction
						: item.direction) === "two_way"
						? (2 as const)
						: (1 as const),
			}));
			const shares = allocateWeightedShares(record.fuelCostPaise, updated);
			await ctx.db.transaction(async (tx) => {
				for (const item of updated) {
					await tx
						.update(journeyParticipant)
						.set({
							direction: item.direction,
							sharePaise:
								shares.find((share) => share.id === item.id)?.sharePaise ?? 0,
						})
						.where(
							and(
								eq(journeyParticipant.journeyId, record.id),
								eq(journeyParticipant.personId, item.id),
							),
						);
				}
			});
			return { success: true };
		}),
});

export const paymentRouter = router({
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				personId: id,
				amountPaise: z.number().int().positive().max(MAX_PAYMENT_PAISE),
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

export const sharedTripRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select({
				groupId: group.id,
				groupName: group.name,
				vehicleName: group.vehicleName,
				personId: person.id,
				personName: person.name,
				ownerName: sql<string>`(select name from "user" where id = ${group.ownerId})`,
				ownerEmail: sql<string>`(select email from "user" where id = ${group.ownerId})`,
				owedPaise: sql<number>`coalesce((select sum(jp.share_paise) from journey_participant jp inner join journey j on j.id = jp.journey_id where jp.person_id = ${person.id} and j.group_id = ${group.id}), 0)`,
				paidPaise: sql<number>`coalesce((select sum(p.amount_paise) from payment p where p.person_id = ${person.id} and p.group_id = ${group.id}), 0)`,
				pendingPaymentPaise: sql<number>`coalesce((select sum(pc.amount_paise) from payment_claim pc where pc.person_id = ${person.id} and pc.group_id = ${group.id} and pc.status = 'pending'), 0)`,
			})
			.from(person)
			.innerJoin(group, eq(group.id, person.groupId))
			.where(
				and(
					eq(person.isActive, 1),
					sql`lower(${person.email}) = lower(${ctx.session.user.email})`,
					sql`${group.ownerId} <> ${ctx.session.user.id}`,
				),
			)
			.orderBy(desc(group.createdAt)),
	),
	detail: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(async ({ ctx, input }) => {
			const [membership] = await ctx.db
				.select({
					groupId: group.id,
					personId: person.id,
					personName: person.name,
					groupName: group.name,
					vehicleName: group.vehicleName,
					ownerName: sql<string>`(select name from "user" where id = ${group.ownerId})`,
					ownerEmail: sql<string>`(select email from "user" where id = ${group.ownerId})`,
					owedPaise: sql<number>`coalesce((select sum(jp.share_paise) from journey_participant jp inner join journey j on j.id = jp.journey_id where jp.person_id = ${person.id} and j.group_id = ${group.id}), 0)`,
					paidPaise: sql<number>`coalesce((select sum(p.amount_paise) from payment p where p.person_id = ${person.id} and p.group_id = ${group.id}), 0)`,
					pendingPaymentPaise: sql<number>`coalesce((select sum(pc.amount_paise) from payment_claim pc where pc.person_id = ${person.id} and pc.group_id = ${group.id} and pc.status = 'pending'), 0)`,
				})
				.from(person)
				.innerJoin(group, eq(group.id, person.groupId))
				.where(
					and(
						eq(group.id, input.groupId),
						eq(person.isActive, 1),
						sql`lower(${person.email}) = lower(${ctx.session.user.email})`,
					),
				)
				.limit(1);
			if (!membership)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Shared trip not found",
				});
			const rows = await ctx.db
				.select({
					id: journey.id,
					journeyDate: journey.journeyDate,
					direction: journeyParticipant.direction,
					distanceKm: journey.distanceKm,
					sharePaise: journeyParticipant.sharePaise,
					correctionId: correctionRequest.id,
					correctionStatus: correctionRequest.status,
				})
				.from(journeyParticipant)
				.innerJoin(journey, eq(journey.id, journeyParticipant.journeyId))
				.leftJoin(
					correctionRequest,
					and(
						eq(correctionRequest.journeyId, journey.id),
						eq(correctionRequest.personId, membership.personId),
					),
				)
				.where(
					and(
						eq(journey.groupId, input.groupId),
						eq(journeyParticipant.personId, membership.personId),
					),
				)
				.orderBy(desc(journey.journeyDate));
			return { ...membership, journeys: rows };
		}),
	raiseCorrection: protectedProcedure
		.input(
			z.object({ journeyId: id, note: z.string().trim().max(500).optional() }),
		)
		.mutation(async ({ ctx, input }) => {
			const [attendance] = await ctx.db
				.select({ personId: person.id })
				.from(journeyParticipant)
				.innerJoin(journey, eq(journey.id, journeyParticipant.journeyId))
				.innerJoin(
					person,
					and(
						eq(person.id, journeyParticipant.personId),
						eq(person.groupId, journey.groupId),
					),
				)
				.where(
					and(
						eq(journey.id, input.journeyId),
						eq(person.isActive, 1),
						sql`lower(${person.email}) = lower(${ctx.session.user.email})`,
					),
				)
				.limit(1);
			if (!attendance)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Attendance record not found",
				});
			const [created] = await ctx.db
				.insert(correctionRequest)
				.values({
					id: crypto.randomUUID(),
					journeyId: input.journeyId,
					personId: attendance.personId,
					requesterUserId: ctx.session.user.id,
					note: input.note || null,
				})
				.onConflictDoNothing()
				.returning();
			if (!created)
				throw new TRPCError({
					code: "CONFLICT",
					message: "A correction was already raised for this journey",
				});
			return created;
		}),
	claimPayment: protectedProcedure
		.input(
			z.object({
				groupId: id,
				amountPaise: z.number().int().positive().max(MAX_PAYMENT_PAISE),
				method: paymentMethodSchema,
				paidOn: isoDateSchema,
				note: z.string().trim().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [membership] = await ctx.db
				.select({ personId: person.id })
				.from(person)
				.innerJoin(group, eq(group.id, person.groupId))
				.where(
					and(
						eq(group.id, input.groupId),
						eq(person.isActive, 1),
						sql`lower(${person.email}) = lower(${ctx.session.user.email})`,
						sql`${group.ownerId} <> ${ctx.session.user.id}`,
					),
				)
				.limit(1);
			if (!membership)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Shared trip not found",
				});
			const [created] = await ctx.db
				.insert(paymentClaim)
				.values({
					id: crypto.randomUUID(),
					groupId: input.groupId,
					personId: membership.personId,
					requesterUserId: ctx.session.user.id,
					amountPaise: input.amountPaise,
					method: input.method,
					paidOn: input.paidOn,
					note: input.note || null,
				})
				.returning();
			return created;
		}),
});

export const paymentClaimRouter = router({
	resolve: protectedProcedure
		.input(
			z.object({
				groupId: id,
				claimId: id,
				status: z.enum(["approved", "rejected"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [claim] = await ctx.db
				.select()
				.from(paymentClaim)
				.where(
					and(
						eq(paymentClaim.id, input.claimId),
						eq(paymentClaim.groupId, input.groupId),
						eq(paymentClaim.status, "pending"),
					),
				)
				.limit(1);
			if (!claim)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Pending payment claim not found",
				});
			return ctx.db.transaction(async (tx) => {
				const [updated] = await tx
					.update(paymentClaim)
					.set({ status: input.status, resolvedAt: new Date() })
					.where(
						and(
							eq(paymentClaim.id, claim.id),
							eq(paymentClaim.status, "pending"),
						),
					)
					.returning();
				if (!updated)
					throw new TRPCError({
						code: "CONFLICT",
						message: "Payment claim was already reviewed",
					});
				if (input.status === "approved")
					await tx.insert(payment).values({
						id: crypto.randomUUID(),
						groupId: claim.groupId,
						personId: claim.personId,
						amountPaise: claim.amountPaise,
						method: claim.method,
						paidOn: claim.paidOn,
						note: claim.note,
					});
				return updated;
			});
		}),
});

export const correctionRouter = router({
	resolve: protectedProcedure
		.input(
			z.object({
				groupId: id,
				correctionId: id,
				status: z.enum(["approved", "rejected"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ownedGroup(ctx, input.groupId);
			const [request] = await ctx.db
				.select({
					id: correctionRequest.id,
					journeyId: correctionRequest.journeyId,
					personId: correctionRequest.personId,
				})
				.from(correctionRequest)
				.innerJoin(journey, eq(journey.id, correctionRequest.journeyId))
				.where(
					and(
						eq(correctionRequest.id, input.correctionId),
						eq(journey.groupId, input.groupId),
					),
				)
				.limit(1);
			if (!request)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Correction not found",
				});
			return ctx.db.transaction(async (tx) => {
				if (input.status === "approved") {
					const remaining = await tx
						.select({
							personId: journeyParticipant.personId,
							direction: journeyParticipant.direction,
						})
						.from(journeyParticipant)
						.where(
							and(
								eq(journeyParticipant.journeyId, request.journeyId),
								sql`${journeyParticipant.personId} <> ${request.personId}`,
							),
						);
					if (!remaining.length)
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "A journey must retain at least one participant",
						});
					const [ride] = await tx
						.select({ fuelCostPaise: journey.fuelCostPaise })
						.from(journey)
						.where(eq(journey.id, request.journeyId))
						.limit(1);
					if (!ride)
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Journey not found",
						});
					const weightedShares = allocateWeightedShares(
						ride.fuelCostPaise,
						remaining.map((member) => ({
							id: member.personId,
							weight: member.direction === "two_way" ? 2 : 1,
						})),
					);
					await tx
						.delete(journeyParticipant)
						.where(
							and(
								eq(journeyParticipant.journeyId, request.journeyId),
								eq(journeyParticipant.personId, request.personId),
							),
						);
					for (const member of remaining)
						await tx
							.update(journeyParticipant)
							.set({
								sharePaise:
									weightedShares.find((share) => share.id === member.personId)
										?.sharePaise ?? 0,
							})
							.where(
								and(
									eq(journeyParticipant.journeyId, request.journeyId),
									eq(journeyParticipant.personId, member.personId),
								),
							);
					await tx
						.update(journey)
						.set({
							participantCount: remaining.length,
							sharePaise: Math.floor(ride.fuelCostPaise / remaining.length),
						})
						.where(eq(journey.id, request.journeyId));
				}
				const [updated] = await tx
					.update(correctionRequest)
					.set({ status: input.status, resolvedAt: new Date() })
					.where(eq(correctionRequest.id, request.id))
					.returning();
				return updated;
			});
		}),
});

const releasePlatform = z.enum(["android", "ios"]);
const releaseVersion = z
	.string()
	.trim()
	.regex(/^\d+\.\d+\.\d+$/, "Use a semantic version such as 1.2.0");
const secureDownloadUrl = z
	.string()
	.url()
	.max(2048)
	.refine((value) => new URL(value).protocol === "https:", "HTTPS is required");

export const releaseRouter = router({
	latest: publicProcedure
		.input(z.object({ platform: releasePlatform.default("android") }))
		.query(async ({ ctx, input }) => {
			const [latest] = await ctx.db
				.select({
					platform: appRelease.platform,
					version: appRelease.version,
					downloadUrl: appRelease.downloadUrl,
					notes: appRelease.notes,
					publishedAt: appRelease.publishedAt,
				})
				.from(appRelease)
				.where(eq(appRelease.platform, input.platform))
				.orderBy(desc(appRelease.publishedAt))
				.limit(1);
			return latest ?? null;
		}),
});

export const adminRouter = router({
	overview: adminProcedure.query(async ({ ctx }) => {
		const [users, trips, releases] = await Promise.all([
			ctx.db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
					createdAt: user.createdAt,
				})
				.from(user)
				.orderBy(desc(user.createdAt)),
			ctx.db
				.select({
					id: group.id,
					name: group.name,
					vehicleName: group.vehicleName,
					fuelType: group.fuelType,
					fuelDistrict: group.fuelDistrict,
					ownerId: group.ownerId,
					ownerName: user.name,
					ownerEmail: user.email,
					createdAt: group.createdAt,
				})
				.from(group)
				.innerJoin(user, eq(user.id, group.ownerId))
				.orderBy(desc(group.createdAt)),
			ctx.db
				.select()
				.from(appRelease)
				.orderBy(desc(appRelease.publishedAt))
				.limit(20),
		]);
		return { users, trips, releases };
	}),
	publishRelease: adminProcedure
		.input(
			z.object({
				platform: releasePlatform,
				version: releaseVersion,
				downloadUrl: secureDownloadUrl,
				notes: z.string().trim().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [created] = await ctx.db
				.insert(appRelease)
				.values({
					id: crypto.randomUUID(),
					...input,
					publishedBy: ctx.session.user.id,
				})
				.returning();
			return created;
		}),
});

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	admin: adminRouter,
	releases: releaseRouter,
	groups: groupRouter,
	people: peopleRouter,
	fuel: fuelRouter,
	journeys: journeyRouter,
	payments: paymentRouter,
	sharedTrips: sharedTripRouter,
	corrections: correctionRouter,
	paymentClaims: paymentClaimRouter,
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
				pendingPaymentClaims: [],
				pendingCorrections: [],
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
		const pendingPaymentClaims = await ctx.db
			.select({
				id: paymentClaim.id,
				groupId: paymentClaim.groupId,
				groupName: group.name,
				personName: person.name,
				amountPaise: paymentClaim.amountPaise,
				method: paymentClaim.method,
				paidOn: paymentClaim.paidOn,
			})
			.from(paymentClaim)
			.innerJoin(group, eq(group.id, paymentClaim.groupId))
			.innerJoin(person, eq(person.id, paymentClaim.personId))
			.where(
				and(
					inArray(paymentClaim.groupId, groupIds),
					eq(paymentClaim.status, "pending"),
				),
			)
			.orderBy(desc(paymentClaim.createdAt));
		const pendingCorrections = await ctx.db
			.select({
				id: correctionRequest.id,
				groupId: group.id,
				groupName: group.name,
				personName: person.name,
			})
			.from(correctionRequest)
			.innerJoin(journey, eq(journey.id, correctionRequest.journeyId))
			.innerJoin(group, eq(group.id, journey.groupId))
			.innerJoin(person, eq(person.id, correctionRequest.personId))
			.where(
				and(
					inArray(group.id, groupIds),
					eq(correctionRequest.status, "pending"),
				),
			)
			.orderBy(desc(correctionRequest.createdAt));
		return {
			groupCount: groups.length,
			journeyCount: allJourneys.length,
			totalOwedPaise: Number(owed[0]?.total ?? 0),
			totalPaidPaise: Number(payments[0]?.total ?? 0),
			recentJourneys: allJourneys.slice(0, 5),
			pendingPaymentClaims,
			pendingCorrections,
		};
	}),
});

export type AppRouter = typeof appRouter;
