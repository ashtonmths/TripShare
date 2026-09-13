"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	const isDark = mounted && resolvedTheme === "dark";

	return (
		<button
			type="button"
			className="theme-switch"
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			aria-pressed={isDark}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			<Sun size={14} aria-hidden="true" />
			<Moon size={14} aria-hidden="true" />
			<span className="theme-switch-thumb" />
		</button>
	);
}
