"use client";
import { Gauge, House, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DownloadAppLink } from "./download-app-link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const pathname = usePathname();
	const [drawerOpen, setDrawerOpen] = useState(false);
	if (pathname === "/login") return null;
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
					<DownloadAppLink />
					<UserMenu />
				</div>
				<button
					type="button"
					className="mobile-nav-toggle"
					aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
					aria-expanded={drawerOpen}
					onClick={() => setDrawerOpen((open) => !open)}
				>
					{drawerOpen ? <X /> : <Menu />}
				</button>
			</div>
			{drawerOpen && (
				<>
					<button
						type="button"
						className="mobile-drawer-backdrop"
						aria-label="Close navigation"
						onClick={() => setDrawerOpen(false)}
					/>
					<aside className="mobile-drawer" aria-label="Mobile navigation">
						<strong>TripShare</strong>
						<nav>
							<Link href="/" onClick={() => setDrawerOpen(false)}>
								<House size={19} /> Home
							</Link>
							<Link href="/dashboard" onClick={() => setDrawerOpen(false)}>
								<Gauge size={19} /> Ledger
							</Link>
						</nav>
						<div className="mobile-drawer-actions">
							<span>Appearance</span>
							<ModeToggle />
						</div>
						<DownloadAppLink mobile />
						<UserMenu />
					</aside>
				</>
			)}
		</header>
	);
}
