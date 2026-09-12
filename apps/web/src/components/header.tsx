"use client";
import { Gauge, House } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	return (
		<header className="site-header">
			<div className="nav-shell">
				<Link className="brand" href="/">
					<span className="brand-mark">
						<Image
							src="/favicon/web-app-manifest-192x192.png"
							alt=""
							width={32}
							height={32}
							priority
						/>
					</span>
					TripShare
				</Link>
				<nav className="main-nav" aria-label="Main navigation">
					<Link href="/">
						<House size={16} /> Home
					</Link>
					<Link href="/dashboard">
						<Gauge size={16} /> Ledger
					</Link>
				</nav>
				<div className="nav-actions">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
