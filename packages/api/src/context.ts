import type { createAuth } from "@TripShare/auth";
import type { Database } from "@TripShare/db";

export type Context = {
  auth: null;
  indianApiKey?: string;
  session: Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;
  db: Database;
};
