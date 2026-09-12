import { formatRupees } from "@TripShare/shared";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function Home() {
	const { data: session } = authClient.useSession();
	const dashboard = useQuery({
		...trpc.dashboard.queryOptions(),
		enabled: Boolean(session),
	});
	if (!session)
		return (
			<Container className="px-5 pt-8">
				<View className="mb-7">
					<Text className="font-bold text-sm text-success uppercase tracking-widest">
						Private carpool ledger
					</Text>
					<Text className="mt-2 font-bold text-4xl text-foreground">
						Welcome to TripShare
					</Text>
					<Text className="mt-3 text-base text-muted leading-6">
						Sign in as the vehicle owner. Your passengers never need accounts.
					</Text>
				</View>
				<SignIn />
				<SignUp />
			</Container>
		);
	if (dashboard.isLoading)
		return (
			<Container isScrollable={false} className="items-center justify-center">
				<ActivityIndicator />
			</Container>
		);
	const due =
		(dashboard.data?.totalOwedPaise ?? 0) -
		(dashboard.data?.totalPaidPaise ?? 0);
	return (
		<Container className="px-5 pt-5">
			<Text className="text-muted text-sm">Hello, {session.user.name}</Text>
			<Text className="mt-1 font-bold text-3xl text-foreground">
				Your ride ledger
			</Text>
			<View className="mt-6 rounded-3xl bg-success p-6">
				<Text className="font-semibold text-sm text-white/80">
					TOTAL OUTSTANDING
				</Text>
				<Text className="mt-2 font-bold text-4xl text-white">
					{formatRupees(due)}
				</Text>
				<Text className="mt-2 text-white/80">
					{dashboard.data?.journeyCount ?? 0} journeys ·{" "}
					{dashboard.data?.groupCount ?? 0} groups
				</Text>
			</View>
			<View className="mt-5 flex-row gap-3">
				<Pressable
					onPress={() => router.push("/(drawer)/(tabs)/two")}
					className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-foreground p-4"
				>
					<Ionicons name="add" size={20} color="white" />
					<Text className="font-bold text-background">Journey</Text>
				</Pressable>
				<Pressable
					onPress={() => router.push("/(drawer)/(tabs)")}
					className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border p-4"
				>
					<Ionicons name="people-outline" size={20} />
					<Text className="font-bold text-foreground">Groups</Text>
				</Pressable>
			</View>
			<Text className="mt-8 mb-2 font-bold text-foreground text-lg">
				Recent journeys
			</Text>
			{!dashboard.data?.recentJourneys.length ? (
				<View className="items-center rounded-2xl border border-border border-dashed p-8">
					<Ionicons name="car-outline" size={30} />
					<Text className="mt-3 text-muted">
						Your journeys will appear here.
					</Text>
				</View>
			) : (
				dashboard.data.recentJourneys.map((item) => (
					<View
						key={item.id}
						className="flex-row items-center border-border border-b py-4"
					>
						<View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-default">
							<Ionicons name="car-outline" size={20} />
						</View>
						<View className="flex-1">
							<Text className="font-semibold text-foreground">
								{item.direction === "two_way"
									? "Return journey"
									: "One-way journey"}
							</Text>
							<Text className="text-muted text-sm">
								{item.journeyDate} · {item.distanceKm} km
							</Text>
						</View>
						<Text className="font-bold text-foreground">
							{formatRupees(item.fuelCostPaise)}
						</Text>
					</View>
				))
			)}
		</Container>
	);
}
