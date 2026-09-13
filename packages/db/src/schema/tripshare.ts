import { relations } from "drizzle-orm";
import {
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const journeyDirection = pgEnum("journey_direction", [
	"one_way",
	"two_way",
]);
export const priceSource = pgEnum("price_source", [
	"indianapi",
	"mypetrolprice",
	"manual",
]);
export const fuelType = pgEnum("fuel_type", ["petrol", "diesel"]);
export const correctionStatus = pgEnum("correction_status", [
	"pending",
	"approved",
	"rejected",
]);
export const paymentMethod = pgEnum("payment_method", [
	"upi",
	"cash",
	"bank_transfer",
	"other",
]);

export const group = pgTable(
	"carpool_group",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		vehicleName: text("vehicle_name").notNull(),
		mileageKmpl: numeric("mileage_kmpl", { precision: 7, scale: 2 }).notNull(),
		normalOneWayKm: numeric("normal_one_way_km", {
			precision: 8,
			scale: 2,
		}).notNull(),
		fuelType: fuelType("fuel_type").default("petrol").notNull(),
		fuelState: text("fuel_state").default("Karnataka").notNull(),
		fuelDistrict: text("fuel_district").default("Udupi").notNull(),
		fuelLocationId: integer("fuel_location_id").default(383).notNull(),
		startDate: date("start_date", { mode: "string" }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("group_owner_idx").on(table.ownerId)],
);

export const person = pgTable(
	"person",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		email: text("email"),
		phone: text("phone"),
		isActive: integer("is_active").default(1).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("person_group_idx").on(table.groupId),
		uniqueIndex("person_group_email_uidx").on(table.groupId, table.email),
	],
);

export const journey = pgTable(
	"journey",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		journeyDate: date("journey_date", { mode: "string" }).notNull(),
		direction: journeyDirection("direction").notNull(),
		distanceKm: numeric("distance_km", { precision: 8, scale: 2 }).notNull(),
		mileageKmpl: numeric("mileage_kmpl", { precision: 7, scale: 2 }).notNull(),
		petrolPricePaise: integer("petrol_price_paise").notNull(),
		petrolPriceSource: priceSource("petrol_price_source").notNull(),
		fuelCostPaise: integer("fuel_cost_paise").notNull(),
		sharePaise: integer("share_paise").notNull(),
		participantCount: integer("participant_count").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("journey_group_date_idx").on(table.groupId, table.journeyDate),
	],
);

export const journeyParticipant = pgTable(
	"journey_participant",
	{
		journeyId: text("journey_id")
			.notNull()
			.references(() => journey.id, { onDelete: "cascade" }),
		personId: text("person_id")
			.notNull()
			.references(() => person.id, { onDelete: "restrict" }),
		sharePaise: integer("share_paise").notNull(),
	},
	(table) => [
		uniqueIndex("journey_participant_uidx").on(table.journeyId, table.personId),
	],
);

export const payment = pgTable(
	"payment",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		personId: text("person_id")
			.notNull()
			.references(() => person.id, { onDelete: "restrict" }),
		amountPaise: integer("amount_paise").notNull(),
		method: paymentMethod("method").notNull(),
		paidOn: date("paid_on", { mode: "string" }).notNull(),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("payment_group_person_idx").on(table.groupId, table.personId),
	],
);

export const correctionRequest = pgTable(
	"correction_request",
	{
		id: text("id").primaryKey(),
		journeyId: text("journey_id")
			.notNull()
			.references(() => journey.id, { onDelete: "cascade" }),
		personId: text("person_id")
			.notNull()
			.references(() => person.id, { onDelete: "cascade" }),
		requesterUserId: text("requester_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		note: text("note"),
		status: correctionStatus("status").default("pending").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("correction_journey_person_uidx").on(
			table.journeyId,
			table.personId,
		),
		index("correction_person_idx").on(table.personId),
	],
);

export const paymentClaim = pgTable(
	"payment_claim",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		personId: text("person_id")
			.notNull()
			.references(() => person.id, { onDelete: "cascade" }),
		requesterUserId: text("requester_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		amountPaise: integer("amount_paise").notNull(),
		method: paymentMethod("method").notNull(),
		paidOn: date("paid_on", { mode: "string" }).notNull(),
		note: text("note"),
		status: correctionStatus("status").default("pending").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
	},
	(table) => [
		index("payment_claim_group_status_idx").on(table.groupId, table.status),
	],
);

export const groupRelations = relations(group, ({ many, one }) => ({
	owner: one(user, { fields: [group.ownerId], references: [user.id] }),
	people: many(person),
	journeys: many(journey),
	payments: many(payment),
}));

export const personRelations = relations(person, ({ many, one }) => ({
	group: one(group, { fields: [person.groupId], references: [group.id] }),
	journeys: many(journeyParticipant),
	payments: many(payment),
}));

export const journeyRelations = relations(journey, ({ many, one }) => ({
	group: one(group, { fields: [journey.groupId], references: [group.id] }),
	participants: many(journeyParticipant),
}));

export const journeyParticipantRelations = relations(
	journeyParticipant,
	({ one }) => ({
		journey: one(journey, {
			fields: [journeyParticipant.journeyId],
			references: [journey.id],
		}),
		person: one(person, {
			fields: [journeyParticipant.personId],
			references: [person.id],
		}),
	}),
);

export const paymentRelations = relations(payment, ({ one }) => ({
	group: one(group, { fields: [payment.groupId], references: [group.id] }),
	person: one(person, { fields: [payment.personId], references: [person.id] }),
}));
