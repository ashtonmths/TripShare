import { formatRupees } from "@TripShare/shared";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { AppLoading } from "@/components/app-loading";
import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { useObserveReady } from "@/hooks/use-observe-ready";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { trpc } from "@/utils/trpc";

export function Home({ inTabs = false }: { inTabs?: boolean }) {
	const { data: session, isPending } = authClient.useSession();
	useEffect(() => {
		if (session && !inTabs) router.replace("/(drawer)/(tabs)/home");
	}, [inTabs, session]);
	const dashboard = useQuery({
		...trpc.dashboard.queryOptions(),
		enabled: Boolean(session),
	});
	const shared = useQuery({
		...trpc.sharedTrips.list.queryOptions(),
		enabled: Boolean(session),
	});
	useObserveReady(
		!isPending && (!session || (!dashboard.isLoading && !shared.isLoading)),
	);
	if (isPending) return <AppLoading />;
	if (!session)
		return (
			<Container safeTop className="px-5">
				<View className="mb-7">
					<View
						className="mb-5 h-14 w-14 items-center justify-center border-2 border-foreground bg-[#c8f55a]"
						style={hardShadow}
					>
						<Ionicons name="car-sport" size={28} color="#111" />
					</View>
					<Text className="font-black text-4xl text-foreground">
						Every shared ride, settled.
					</Text>
					<Text className="mt-3 text-base text-muted leading-6">
						Manage a carpool or view attendance shared with your Google email.
					</Text>
				</View>
				<SignIn />
				<Text className="mt-5 text-center text-muted text-xs">
					TripShare uses Google sign-in only. Partners get read-only access.
				</Text>
			</Container>
		);
	const due =
		(dashboard.data?.totalOwedPaise ?? 0) -
		(dashboard.data?.totalPaidPaise ?? 0);
	return (
		<Container className="px-4 pt-4">
			<View className="flex-row items-start justify-between gap-3">
				<View className="flex-1">
					<Text className="text-muted text-sm">Hello, {session.user.name}</Text>
					<Text className="mt-1 font-black text-3xl text-foreground">
						Your TripShare
					</Text>
				</View>
				<Pressable
					accessibilityLabel="Open profile"
					onPress={() => router.push("/(drawer)/(tabs)/three")}
					className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-background"
				>
					{session.user.image ? (
						<Image
							source={{ uri: session.user.image }}
							className="h-full w-full"
						/>
					) : (
						<Text className="font-black text-foreground">
							{session.user.name.slice(0, 1).toUpperCase()}
						</Text>
					)}
				</Pressable>
			</View>
			{dashboard.error && (
				<View className="mt-5 border-2 border-foreground bg-[#ff9fb2] p-4">
					<Text className="font-black text-black">
						Couldn’t load your ledger
					</Text>
					<Pressable onPress={() => dashboard.refetch()}>
						<Text className="mt-2 font-black text-black underline">
							Try again
						</Text>
					</Pressable>
				</View>
			)}
			{(dashboard.data?.groupCount ?? 0) > 0 && (
				<View
					className="mt-6 border-2 border-foreground bg-[#c8f55a] p-5"
					style={hardShadow}
				>
					<Text className="font-black text-black text-sm">OUTSTANDING</Text>
					<Text className="mt-1 font-black text-4xl text-black">
						{formatRupees(due)}
					</Text>
					<Text className="mt-2 text-black">
						{dashboard.data?.journeyCount ?? 0} rides ·{" "}
						{dashboard.data?.groupCount ?? 0} owned trips
					</Text>
				</View>
			)}
			<Text className="mt-7 mb-3 font-black text-foreground text-xl">
				Payments
			</Text>
			{shared.data?.map((item) => {
				const remaining = Number(item.owedPaise) - Number(item.paidPaise);
				return (
					<Pressable
						key={item.groupId}
						onPress={() => router.push("/(drawer)/(tabs)")}
						className="mb-3 border-2 border-foreground bg-background p-4"
					>
						<Text className="font-black text-foreground">
							Pay {item.ownerName}
						</Text>
						<Text className="mt-1 text-muted text-sm">
							{item.groupName} · {item.ownerEmail}
						</Text>
						<Text className="mt-2 font-black text-foreground text-xl">
							{formatRupees(Math.max(0, remaining))} remaining
						</Text>
						<Text className="text-muted text-xs">
							{formatRupees(Number(item.pendingPaymentPaise))} pending owner
							approval
						</Text>
					</Pressable>
				);
			})}
			{dashboard.data?.pendingPaymentClaims.map((item) => (
				<Pressable
					key={item.id}
					onPress={() => router.push("/(drawer)/(tabs)")}
					className="mb-3 border-2 border-foreground bg-[#c8f55a] p-4"
				>
					<Text className="font-black text-black">
						Approval needed · {item.personName}
					</Text>
					<Text className="mt-1 text-black">
						{formatRupees(item.amountPaise)} · {item.groupName}
					</Text>
				</Pressable>
			))}
			{dashboard.data?.pendingCorrections.map((item) => (
				<Pressable
					key={item.id}
					onPress={() => router.push("/(drawer)/(tabs)")}
					className="mb-3 border-2 border-foreground bg-[#ff9fb2] p-4"
				>
					<Text className="font-black text-black">
						Attendance dispute · {item.personName}
					</Text>
					<Text className="mt-1 text-black">Review in {item.groupName}</Text>
				</Pressable>
			))}
			{!shared.data?.length &&
				!dashboard.data?.pendingPaymentClaims.length &&
				!dashboard.data?.pendingCorrections.length && (
					<Text className="text-muted">No payments need attention.</Text>
				)}
			<Text className="mt-7 mb-3 font-black text-foreground text-xl">
				What do you need?
			</Text>
			<View className="gap-3">
				<HomeAction
					color="bg-[#ff9fb2]"
					icon="add-circle-outline"
					title="Record a ride"
					caption="Date, attendance, fuel price and split"
					onPress={() => router.push("/(drawer)/(tabs)/two")}
				/>
				<HomeAction
					color="bg-[#8dc8ff]"
					icon="car-outline"
					title="Manage trips"
					caption="Partners, payments, balances and settings"
					onPress={() => router.push("/(drawer)/(tabs)")}
				/>
			</View>
			<Text className="mt-7 mb-3 font-black text-foreground text-xl">
				Recent rides
			</Text>
			{dashboard.isLoading ? (
				<Text className="text-muted">Loading activity…</Text>
			) : !dashboard.data?.recentJourneys.length ? (
				<View className="items-center border-2 border-foreground border-dashed p-7">
					<Ionicons name="trail-sign-outline" size={30} />
					<Text className="mt-2 text-center text-muted">
						No recent rides yet. Your recorded rides will appear here.
					</Text>
				</View>
			) : (
				dashboard.data.recentJourneys.map((item) => (
					<View
						key={item.id}
						className="mb-2 flex-row items-center border-2 border-foreground bg-background p-4"
					>
						<View className="mr-3 h-10 w-10 items-center justify-center border-2 border-foreground bg-[#8dc8ff]">
							<Ionicons name="car-outline" size={19} color="#111" />
						</View>
						<View className="flex-1">
							<Text className="font-black text-foreground">
								{item.direction === "two_way" ? "Return ride" : "One-way ride"}
							</Text>
							<Text className="text-muted text-xs">
								{item.journeyDate} · {item.distanceKm} km
							</Text>
						</View>
						<Text className="font-black text-foreground">
							{formatRupees(item.fuelCostPaise)}
						</Text>
					</View>
				))
			)}
		</Container>
	);
}

export default function SignInGateway() {
	return <Home />;
}

function HomeAction({
	color,
	icon,
	title,
	caption,
	onPress,
}: {
	color: string;
	icon: keyof typeof Ionicons.glyphMap;
	title: string;
	caption: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className={`flex-row items-center border-2 border-foreground p-4 ${color}`}
			style={hardShadow}
		>
			<View className="mr-3 h-11 w-11 items-center justify-center border-2 border-black bg-white">
				<Ionicons name={icon} size={22} color="#111" />
			</View>
			<View className="flex-1">
				<Text className="font-black text-black text-lg">{title}</Text>
				<Text className="text-black text-sm">{caption}</Text>
			</View>
			<Ionicons name="chevron-forward" size={21} color="#111" />
		</Pressable>
	);
}
