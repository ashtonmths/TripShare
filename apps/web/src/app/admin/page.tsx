import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { env } from "@/env.server";
import { auth } from "@/services";
import AdminPanel from "./panel";

const PRIMARY_ADMIN_EMAIL = "mathiasashton07@gmail.com";

export default async function AdminPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) redirect("/login");
	const allowed = [PRIMARY_ADMIN_EMAIL, ...(env.ADMIN_EMAILS ?? "").split(",")]
		.map((email) => email.trim().toLowerCase())
		.includes(session.user.email.trim().toLowerCase());
	if (!allowed) notFound();
	return <AdminPanel />;
}
