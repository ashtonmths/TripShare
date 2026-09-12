"use client";
import { CarFront, Gauge, House } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	return (
		<header className="site-header">
			<div className="nav-shell">
				<Link className="brand" href="/">
					<span className="brand-mark">
						<CarFront size={19} />
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
