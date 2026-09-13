import { formatRupees } from "@TripShare/shared";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { trpc } from "@/utils/trpc";

export default function SharedTrips() {
	const { data: session } = authClient.useSession();
	const list = useQuery({
		...trpc.sharedTrips.list.queryOptions(),
		enabled: Boolean(session),
	});
	const [selected, setSelected] = useState<string>();
	const groupId = selected ?? list.data?.[0]?.groupId;
	const detail = useQuery({
		...trpc.sharedTrips.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(session && groupId),
	});
	const correction = useMutation(
		trpc.sharedTrips.raiseCorrection.mutationOptions({
			onSuccess: async () => {
				Alert.alert(
					"Correction sent",
					"The owner can review it from their trip.",
				);
				await detail.refetch();
			},
			onError: (error) => Alert.alert("Couldn’t send", error.message),
		}),
	);

	if (!session)
		return (
			<Container className="px-5 pt-8">
				<Text className="font-black text-3xl text-foreground">
					Sign in first
				</Text>
				<Text className="mt-2 text-muted">
					Shared attendance is matched to your Google email.
				</Text>
				<Pressable
					onPress={() => router.replace("/(drawer)")}
					className="mt-6 border-2 border-foreground bg-[#c8f55a] p-4"
					style={hardShadow}
				>
					<Text className="text-center font-black text-black">
						Go to sign in
					</Text>
				</Pressable>
			</Container>
		);
	return (
		<Container className="px-4 pt-4">
			<Text className="font-black text-3xl text-foreground">
				Shared with me
			</Text>
			<Text className="mt-1 text-muted">
				Your attendance only. Trip settings and other partners stay private.
			</Text>
			{list.isLoading && (
				<Text className="mt-8 text-muted">Finding shared trips…</Text>
			)}
			{list.error && (
				<View className="mt-6 border-2 border-foreground bg-[#ff9fb2] p-4">
					<Text className="font-black text-black">
						Couldn’t load shared trips
					</Text>
					<Text className="mt-1 text-black text-sm">{list.error.message}</Text>
					<Pressable onPress={() => list.refetch()}>
						<Text className="mt-3 font-black text-black underline">
							Try again
						</Text>
					</Pressable>
				</View>
			)}
			{!list.isLoading && !list.data?.length && (
				<View className="mt-6 items-center border-2 border-foreground border-dashed p-8">
					<Ionicons name="mail-outline" size={32} />
					<Text className="mt-3 text-center font-bold text-foreground">
						Nothing shared yet
					</Text>
					<Text className="mt-1 text-center text-muted">
						Ask the trip owner to add {session.user.email}. The trip appears
						here automatically.
					</Text>
				</View>
			)}
			<View className="mt-5 flex-row flex-wrap gap-2">
				{list.data?.map((item) => (
					<Pressable
						key={item.groupId}
						onPress={() => setSelected(item.groupId)}
						className={`border-2 border-foreground px-4 py-3 ${groupId === item.groupId ? "bg-[#c8f55a]" : "bg-background"}`}
					>
						<Text className="font-black text-foreground">{item.groupName}</Text>
					</Pressable>
				))}
			</View>
			{detail.data && (
				<View
					className="mt-5 border-2 border-foreground bg-[#8dc8ff] p-4"
					style={hardShadow}
				>
					<Text className="font-black text-black text-xl">
						{detail.data.groupName}
					</Text>
					<Text className="mt-1 text-black">
						{detail.data.vehicleName} · viewing as {detail.data.personName}
					</Text>
				</View>
			)}
			{detail.isLoading && (
				<Text className="mt-6 text-muted">Loading attendance…</Text>
			)}
			<View className="mt-5 gap-3">
				{detail.data?.journeys.map((ride) => (
					<View
						key={ride.id}
						className="border-2 border-foreground bg-background p-4"
					>
						<View className="flex-row items-start justify-between gap-3">
							<View className="flex-1">
								<Text className="font-black text-foreground">
									{ride.journeyDate}
								</Text>
								<Text className="mt-1 text-muted">
									{ride.direction === "two_way" ? "Return" : "One way"} ·{" "}
									{ride.distanceKm} km
								</Text>
							</View>
							<Text className="font-black text-foreground">
								{formatRupees(ride.sharePaise)}
							</Text>
						</View>
						{ride.correctionStatus ? (
							<View className="mt-3 self-start border-2 border-foreground bg-[#c8f55a] px-3 py-2">
								<Text className="font-black text-black">
									Correction {ride.correctionStatus}
								</Text>
							</View>
						) : (
							<Pressable
								disabled={correction.isPending}
								className="mt-3 border-2 border-foreground bg-[#ff9fb2] p-3"
								onPress={() =>
									Alert.alert(
										"Report attendance",
										"Tell the owner you were marked present by mistake?",
										[
											{ text: "Cancel", style: "cancel" },
											{
												text: "Send",
												onPress: () =>
													correction.mutate({
														journeyId: ride.id,
														note: "I did not join this journey.",
													}),
											},
										],
									)
								}
							>
								<Text className="text-center font-black text-black">
									I wasn’t on this ride
								</Text>
							</Pressable>
						)}
					</View>
				))}
			</View>
			{detail.data && !detail.data.journeys.length && (
				<View className="mt-5 border-2 border-foreground border-dashed p-8">
					<Text className="text-center text-muted">
						No attendance has been recorded for you in this trip.
					</Text>
				</View>
			)}
		</Container>
	);
}
