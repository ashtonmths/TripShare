import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { calculateFuelCost, formatRupees } from "@TripShare/shared";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Container } from "@/components/container";
import { queryClient, trpc } from "@/utils/trpc";

export default function AddJourney() {
	const groups = useQuery(trpc.groups.list.queryOptions());
	const [groupId, setGroupId] = useState<string>();
	const currentId = groupId ?? groups.data?.[0]?.id;
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: currentId ?? "" }),
		enabled: Boolean(currentId),
	});
	const fuel = useQuery({
		...trpc.fuel.current.queryOptions(),
		enabled: false,
		retry: false,
	});
	const [price, setPrice] = useState<number>();
	const [manual, setManual] = useState("");
	const [people, setPeople] = useState<string[]>([]);
	const [twoWay, setTwoWay] = useState(false);
	const [distance, setDistance] = useState("");
	const km = Number(
		distance ||
			Number(detail.data?.group.normalOneWayKm ?? 0) * (twoWay ? 2 : 1),
	);
	const cost = useMemo(
		() =>
			price && people.length && detail.data
				? calculateFuelCost({
						distanceKm: km,
						mileageKmpl: Number(detail.data.group.mileageKmpl),
						petrolPricePaise: price,
						participantCount: people.length,
					})
				: undefined,
		[detail.data, km, people.length, price],
	);
	const save = useMutation(
		trpc.journeys.create.mutationOptions({
			onSuccess: async () => {
				Alert.alert("Journey saved", "Balances are updated.");
				setPeople([]);
				setPrice(undefined);
				await queryClient.invalidateQueries();
			},
			onError: (e) => Alert.alert("Couldn’t save", e.message),
		}),
	);
	const fetchPrice = async () => {
		const result = await fuel.refetch();
		if (result.data) setPrice(result.data.pricePaise);
	};
	return (
		<Container className="px-5 pt-5">
			<Text className="text-3xl font-bold text-foreground">Add journey</Text>
			<Text className="mt-2 text-muted">
				A quick, exact split while the ride is fresh.
			</Text>
			<Text className="mb-2 mt-6 text-sm font-bold text-foreground">GROUP</Text>
			<View className="flex-row flex-wrap gap-2">
				{groups.data?.map((g) => (
					<Pressable
						key={g.id}
						onPress={() => {
							setGroupId(g.id);
							setPeople([]);
						}}
						className={`rounded-full border px-4 py-3 ${currentId === g.id ? "border-success bg-success/15" : "border-border"}`}
					>
						<Text className="font-semibold text-foreground">{g.name}</Text>
					</Pressable>
				))}
			</View>
			<Text className="mb-2 mt-6 text-sm font-bold text-foreground">
				DIRECTION
			</Text>
			<View className="flex-row gap-2">
				{[false, true].map((value) => (
					<Pressable
						key={String(value)}
						onPress={() => {
							setTwoWay(value);
							setDistance("");
						}}
						className={`flex-1 rounded-xl border p-4 ${twoWay === value ? "border-success bg-success/15" : "border-border"}`}
					>
						<Text className="text-center font-semibold text-foreground">
							{value ? "Two way" : "One way"}
						</Text>
					</Pressable>
				))}
			</View>
			<Text className="mb-2 mt-6 text-sm font-bold text-foreground">
				DISTANCE (KM)
			</Text>
			<TextInput
				value={distance || String(km || "")}
				onChangeText={setDistance}
				keyboardType="decimal-pad"
				className="rounded-xl border border-border px-4 py-4 text-foreground"
			/>
			<Text className="mb-2 mt-6 text-sm font-bold text-foreground">
				WHO JOINED?
			</Text>
			<View className="flex-row flex-wrap gap-2">
				{detail.data?.people
					.filter((p) => p.isActive)
					.map((p) => (
						<Pressable
							key={p.id}
							onPress={() =>
								setPeople((old) =>
									old.includes(p.id)
										? old.filter((id) => id !== p.id)
										: [...old, p.id],
								)
							}
							className={`flex-row items-center rounded-full border px-4 py-3 ${people.includes(p.id) ? "border-success bg-success/15" : "border-border"}`}
						>
							{people.includes(p.id) && (
								<Ionicons name="checkmark" size={16} color="#176b52" />
							)}
							<Text className="font-semibold text-foreground"> {p.name}</Text>
						</Pressable>
					))}
			</View>
			<View className="mt-6 rounded-2xl border border-border p-4">
				<View className="flex-row items-center">
          <Ionicons name="flame-outline" size={22} />
					<View className="ml-3 flex-1">
						<Text className="font-bold text-foreground">
							Udupi petrol price
						</Text>
						<Text className="text-sm text-muted">
							{price
								? `${formatRupees(price)} / litre`
								: "Fetch the current price"}
						</Text>
					</View>
					<Pressable
						onPress={fetchPrice}
						className="rounded-xl bg-foreground px-3 py-2"
					>
						<Text className="font-bold text-background">Fetch</Text>
					</Pressable>
				</View>
				{fuel.error && (
					<>
						<Text className="mt-3 text-sm text-danger">
							{fuel.error.message}
						</Text>
						<TextInput
							placeholder="Manual ₹ / litre"
							placeholderTextColor="#888"
							value={manual}
							onChangeText={(v) => {
								setManual(v);
								setPrice(Math.round(Number(v) * 100));
							}}
							keyboardType="decimal-pad"
							className="mt-3 rounded-xl border border-border px-4 py-3 text-foreground"
						/>
					</>
				)}
			</View>
			{cost && (
				<View className="mt-4 flex-row rounded-2xl bg-default p-5">
					<View className="flex-1">
						<Text className="text-sm text-muted">TOTAL</Text>
						<Text className="text-2xl font-bold text-foreground">
							{formatRupees(cost.fuelCostPaise)}
						</Text>
					</View>
					<View className="flex-1">
						<Text className="text-sm text-muted">EACH</Text>
						<Text className="text-2xl font-bold text-foreground">
							{formatRupees(cost.sharePaise)}
						</Text>
					</View>
				</View>
			)}
			<Pressable
				disabled={!currentId || !price || !people.length || save.isPending}
				onPress={() =>
					currentId &&
					price &&
					save.mutate({
						groupId: currentId,
						journeyDate: new Date().toISOString().slice(0, 10),
						direction: twoWay ? "two_way" : "one_way",
						distanceKm: km,
						participantIds: people,
						petrolPricePaise: price,
						petrolPriceSource: fuel.data ? "indianapi" : "manual",
					})
				}
				className="mb-8 mt-5 rounded-2xl bg-success p-5 disabled:opacity-40"
			>
				<Text className="text-center text-lg font-bold text-white">
					{save.isPending ? "Saving…" : "Save journey"}
				</Text>
			</Pressable>
		</Container>
	);
}
