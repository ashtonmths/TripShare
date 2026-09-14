"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function HomeActions() {
	const { data: session, isPending } = authClient.useSession();
	return (
		<div className="hero-actions">
			<Link className="primary-button" href="/dashboard">
				Open your ledger <ArrowRight size={17} />
			</Link>
			{!isPending && !session && <Link href="/login">Sign in with Google</Link>}
		</div>
	);
}
