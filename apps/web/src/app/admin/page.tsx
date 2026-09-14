import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/services";
import AdminPanel from "./panel";

const PRIMARY_ADMIN_EMAIL = "mathiasashton07@gmail.com";

export default async function AdminPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) redirect("/login");
	const allowed =
		session.user.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
	if (!allowed) notFound();
	return <AdminPanel />;
}
