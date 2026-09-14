import type { createAuth } from "@TripShare/auth";
import type { Database } from "@TripShare/db";

export type Context = {
	adminEmails: string[];
	auth: null;
	clientIp: string;
	fuelQuoteSecret: string;
	session: Awaited<
		ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
	>;
	db: Database;
};
