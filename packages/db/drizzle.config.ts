import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
	try {
		loadEnvFile(fileURLToPath(new URL("../../apps/web/.env", import.meta.url)));
	} catch {
		// CI and production provide DATABASE_URL directly.
	}
}

export default defineConfig({
	schema: "./src/schema",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
});
