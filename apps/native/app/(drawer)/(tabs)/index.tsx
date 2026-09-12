import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

export default function Groups() {
	const groups = useQuery(trpc.groups.list.queryOptions());
	return (
		<Container className="px-5 pt-5">
			<Text className="text-3xl font-bold text-foreground">Your groups</Text>
			<Text className="mt-2 text-muted">
				Vehicles, routes, and private contacts.
			</Text>
			<View className="mt-6 gap-3">
				{groups.isLoading ? (
					<Text className="text-muted">Loading groups…</Text>
				) : !groups.data?.length ? (
					<View className="items-center rounded-3xl border border-dashed border-border p-10">
						<Ionicons name="people-outline" size={34} />
						<Text className="mt-3 text-center text-muted">
							Create your first group on the web, then it will sync here.
						</Text>
					</View>
				) : (
					groups.data.map((g) => (
						<View
							key={g.id}
							className="rounded-2xl border border-border bg-background p-5"
						>
							<View className="flex-row items-center">
								<View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-success/15">
									<Ionicons
										name="car-sport-outline"
										size={22}
										color="#176b52"
									/>
								</View>
								<View className="flex-1">
									<Text className="text-lg font-bold text-foreground">
										{g.name}
									</Text>
									<Text className="text-muted">{g.vehicleName}</Text>
								</View>
							</View>
							<View className="mt-4 flex-row gap-6">
								<Text className="text-sm text-muted">
									<Text className="font-bold text-foreground">
										{g.normalOneWayKm}
									</Text>{" "}
									km one way
								</Text>
								<Text className="text-sm text-muted">
									<Text className="font-bold text-foreground">
										{g.mileageKmpl}
									</Text>{" "}
									km/l
								</Text>
							</View>
						</View>
					))
				)}
			</View>
		</Container>
	);
}
