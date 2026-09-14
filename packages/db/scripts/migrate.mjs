import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (!process.env.DATABASE_URL) {
	try {
		loadEnvFile(
			fileURLToPath(new URL("../../../apps/web/.env", import.meta.url)),
		);
	} catch {
		// CI and production provide DATABASE_URL directly.
	}
}

if (!process.env.DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is required. Set it in the environment or apps/web/.env.",
	);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
	await migrate(drizzle(pool), {
		migrationsFolder: fileURLToPath(
			new URL("../src/migrations", import.meta.url),
		),
	});
	console.log("Database migrations applied successfully.");
} finally {
	await pool.end();
}
