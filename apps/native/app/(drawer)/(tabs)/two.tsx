import { calculateFuelCost, formatRupees } from "@TripShare/shared";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Container } from "@/components/container";
import { hardShadow } from "@/lib/neobrutalism";
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
			<Text className="font-bold text-3xl text-foreground">Add journey</Text>
			<Text className="mt-2 text-muted">
				A quick, exact split while the ride is fresh.
			</Text>
			<Text className="mt-6 mb-2 font-black text-foreground text-sm">
				Group
			</Text>
			<View className="flex-row flex-wrap gap-2">
				{groups.data?.map((g) => (
					<Pressable
						key={g.id}
						onPress={() => {
							setGroupId(g.id);
							setPeople([]);
						}}
						className={`border-2 border-foreground px-4 py-3 ${currentId === g.id ? "bg-[#c8f55a]" : "bg-background"}`}
					>
						<Text className="font-semibold text-foreground">{g.name}</Text>
					</Pressable>
				))}
			</View>
			<Text className="mt-6 mb-2 font-black text-foreground text-sm">
				Direction
			</Text>
			<View className="flex-row gap-2">
				{[false, true].map((value) => (
					<Pressable
						key={String(value)}
						onPress={() => {
							setTwoWay(value);
							setDistance("");
						}}
						className={`flex-1 border-2 border-foreground p-4 ${twoWay === value ? "bg-[#8dc8ff]" : "bg-background"}`}
					>
						<Text className="text-center font-semibold text-foreground">
							{value ? "Two way" : "One way"}
						</Text>
					</Pressable>
				))}
			</View>
			<Text className="mt-6 mb-2 font-black text-foreground text-sm">
				Distance (km)
			</Text>
			<TextInput
				value={distance || String(km || "")}
				onChangeText={setDistance}
				keyboardType="decimal-pad"
				className="border-2 border-foreground bg-background px-4 py-4 text-foreground"
			/>
			<Text className="mt-6 mb-2 font-black text-foreground text-sm">
				Who joined?
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
							className={`flex-row items-center border-2 border-foreground px-4 py-3 ${people.includes(p.id) ? "bg-[#c8f55a]" : "bg-background"}`}
						>
							{people.includes(p.id) && (
								<Ionicons name="checkmark" size={16} color="#176b52" />
							)}
							<Text className="font-semibold text-foreground"> {p.name}</Text>
						</Pressable>
					))}
			</View>
			<View
				className="mt-6 border-2 border-foreground bg-[#8dc8ff] p-4"
				style={hardShadow}
			>
				<View className="flex-row items-center">
					<Ionicons name="flame-outline" size={22} />
					<View className="ml-3 flex-1">
						<Text className="font-bold text-foreground">
							Udupi petrol price
						</Text>
						<Text className="text-muted text-sm">
							{price
								? `${formatRupees(price)} / litre`
								: "Fetch the current price"}
						</Text>
					</View>
					<Pressable
						onPress={fetchPrice}
						className="border-2 border-black bg-[#c8f55a] px-3 py-2"
					>
						<Text className="font-black text-black">Fetch</Text>
					</Pressable>
				</View>
				{fuel.error && (
					<>
						<Text className="mt-3 text-danger text-sm">
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
							className="mt-3 border-2 border-black bg-white px-4 py-3 text-black"
						/>
					</>
				)}
			</View>
			{cost && (
				<View
					className="mt-4 flex-row border-2 border-foreground bg-[#ff9fb2] p-5"
					style={hardShadow}
				>
					<View className="flex-1">
						<Text className="text-muted text-sm">TOTAL</Text>
						<Text className="font-bold text-2xl text-foreground">
							{formatRupees(cost.fuelCostPaise)}
						</Text>
					</View>
					<View className="flex-1">
						<Text className="text-muted text-sm">EACH</Text>
						<Text className="font-bold text-2xl text-foreground">
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
				className="mt-5 mb-8 border-2 border-foreground bg-[#c8f55a] p-5 disabled:opacity-40"
				style={hardShadow}
			>
				<Text className="text-center font-black text-black text-lg">
					{save.isPending ? "Saving…" : "Save journey"}
				</Text>
			</Pressable>
		</Container>
	);
}
