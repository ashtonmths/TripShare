import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";
import PwaRegistration from "@/components/pwa-registration";
import { auth } from "@/services";

const spaceGrotesk = Space_Grotesk({
	variable: "--font-space-grotesk",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "TripShare",
	description: "Private carpool fuel expenses, split fairly.",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth.api.getSession({ headers: await headers() });
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${spaceGrotesk.variable} antialiased`}>
				<PwaRegistration />

				<Providers>
					<div className="grid min-h-svh grid-rows-[auto_1fr]">
						<Header initialUser={session?.user ?? null} />
						{children}
					</div>
				</Providers>
			</body>
		</html>
	);
}
