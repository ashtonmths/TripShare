import { formatRupees } from "@TripShare/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Container } from "@/components/container";
import { hardShadow } from "@/lib/neobrutalism";
import { trpc } from "@/utils/trpc";

export default function SharedTrips() {
	const list = useQuery(trpc.sharedTrips.list.queryOptions());
	const [selected, setSelected] = useState<string>();
	const groupId = selected ?? list.data?.[0]?.groupId;
	const detail = useQuery({
		...trpc.sharedTrips.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(groupId),
	});
	const correction = useMutation(
		trpc.sharedTrips.raiseCorrection.mutationOptions({
			onSuccess: async () => {
				Alert.alert("Sent", "The owner can now review your correction.");
				await detail.refetch();
			},
			onError: (error) => Alert.alert("Couldn’t send", error.message),
		}),
	);
	return (
		<Container className="px-5 pt-5">
			<Text className="font-bold text-3xl text-foreground">Shared with me</Text>
			<Text className="mt-2 text-muted">
				Read-only attendance linked to your Google email.
			</Text>
			<View className="mt-5 flex-row flex-wrap gap-2">
				{list.data?.map((item) => (
					<Pressable
						key={item.groupId}
						onPress={() => setSelected(item.groupId)}
						className={`border-2 border-foreground px-4 py-3 ${groupId === item.groupId ? "bg-[#c8f55a]" : "bg-background"}`}
					>
						<Text className="font-bold text-foreground">{item.groupName}</Text>
					</Pressable>
				))}
			</View>
			{!list.isLoading && !list.data?.length && (
				<View className="mt-6 border-2 border-foreground border-dashed p-8">
					<Text className="text-center text-muted">
						No trips are linked to this email yet.
					</Text>
				</View>
			)}
			<View className="mt-5 gap-3">
				{detail.data?.journeys.map((ride) => (
					<View
						key={ride.id}
						className="border-2 border-foreground bg-background p-4"
						style={hardShadow}
					>
						<Text className="font-black text-foreground">
							{ride.journeyDate}
						</Text>
						<Text className="mt-1 text-muted">
							{ride.direction === "two_way" ? "Return" : "One way"} ·{" "}
							{ride.distanceKm} km · {formatRupees(ride.sharePaise)}
						</Text>
						{ride.correctionStatus ? (
							<Text className="mt-3 font-bold text-foreground">
								Correction: {ride.correctionStatus}
							</Text>
						) : (
							<Pressable
								className="mt-3 border-2 border-foreground bg-[#ff9fb2] p-3"
								onPress={() =>
									correction.mutate({
										journeyId: ride.id,
										note: "I did not join this journey.",
									})
								}
							>
								<Text className="text-center font-black text-black">
									I wasn’t there
								</Text>
							</Pressable>
						)}
					</View>
				))}
			</View>
		</Container>
	);
}
