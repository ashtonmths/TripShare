import { createAuth as createConfiguredAuth } from "@TripShare/auth";
import { type Database, createDb } from "@TripShare/db";

import { env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}
export const auth = createConfiguredAuth(env, db);
