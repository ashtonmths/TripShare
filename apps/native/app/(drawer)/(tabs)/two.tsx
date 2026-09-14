import { calculateFuelCost, formatRupees } from "@TripShare/shared";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
	Alert,
	Platform,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import { Container } from "@/components/container";
import { useObserveReady } from "@/hooks/use-observe-ready";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { queryClient, trpc } from "@/utils/trpc";

const isoDay = (offset = 0) =>
	new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const dateToIso = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function Step({ number, title }: { number: number; title: string }) {
	return (
		<Text className="mt-6 mb-2 font-black text-foreground text-sm">
			{number} · {title}
		</Text>
	);
}

export default function AddRide() {
	const { data: session } = authClient.useSession();
	const groups = useQuery({
		...trpc.groups.list.queryOptions(),
		enabled: Boolean(session),
	});
	const [groupId, setGroupId] = useState<string>();
	const currentId = groupId ?? groups.data?.[0]?.id;
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: currentId ?? "" }),
		enabled: Boolean(session && currentId),
	});
	const fuel = useQuery({
		...trpc.fuel.current.queryOptions({ groupId: currentId ?? "" }),
		enabled: false,
		retry: false,
	});
	const [price, setPrice] = useState<number>();
	const [quote, setQuote] = useState<string>();
	const [manual, setManual] = useState("");
	const [showManual, setShowManual] = useState(false);
	const [people, setPeople] = useState<string[]>([]);
	const [twoWay, setTwoWay] = useState(false);
	const [distance, setDistance] = useState("");
	const [journeyDate, setJourneyDate] = useState(isoDay());
	const [showDatePicker, setShowDatePicker] = useState(false);
	useObserveReady(
		Boolean(session) && !groups.isLoading && (!currentId || !detail.isLoading),
	);
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
				Alert.alert("Ride saved", "Everyone’s balance is up to date.");
				setPeople([]);
				setPrice(undefined);
				setQuote(undefined);
				setManual("");
				await queryClient.invalidateQueries();
			},
			onError: (error) => Alert.alert("Couldn’t save", error.message),
		}),
	);
	const switchTrip = (id: string) => {
		setGroupId(id);
		setPeople([]);
		setPrice(undefined);
		setQuote(undefined);
		setDistance("");
	};
	const fetchPrice = async () => {
		const result = await fuel.refetch();
		if (result.data) {
			setPrice(result.data.pricePaise);
			setQuote(result.data.quoteToken);
			setManual("");
			setShowManual(false);
		}
	};

	if (!session)
		return (
			<Container className="px-5 pt-8">
				<Text className="font-black text-3xl text-foreground">
					Sign in first
				</Text>
				<Text className="mt-2 text-muted">
					Sign in before recording a ride.
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
			<Text className="font-black text-3xl text-foreground">Add ride</Text>
			<Text className="mt-1 text-muted">Five quick choices, then save.</Text>
			{groups.error && (
				<View className="mt-5 border-2 border-foreground bg-[#ff9fb2] p-4">
					<Text className="font-bold text-black">Couldn’t load trips</Text>
					<Pressable onPress={() => groups.refetch()}>
						<Text className="mt-2 font-black text-black underline">
							Try again
						</Text>
					</Pressable>
				</View>
			)}
			{!groups.isLoading && !groups.data?.length && (
				<View className="mt-5 border-2 border-foreground border-dashed p-8">
					<Text className="text-center text-muted">
						Create a trip and add a partner first.
					</Text>
					<Pressable
						onPress={() => router.replace("/(drawer)/(tabs)")}
						className="mt-4 border-2 border-foreground bg-[#c8f55a] p-3"
					>
						<Text className="text-center font-black text-black">
							Create trip
						</Text>
					</Pressable>
				</View>
			)}
			<Step number={1} title="Trip" />
			<View className="flex-row flex-wrap gap-2">
				{groups.data?.map((item) => (
					<Pressable
						key={item.id}
						onPress={() => switchTrip(item.id)}
						className={`border-2 border-foreground px-4 py-3 ${currentId === item.id ? "bg-[#c8f55a]" : "bg-background"}`}
					>
						<Text
							className={`font-black ${currentId === item.id ? "text-black" : "text-foreground"}`}
						>
							{item.name}
						</Text>
					</Pressable>
				))}
			</View>
			<Step number={2} title="Date" />
			<View className="mb-2 flex-row gap-2">
				<Choice
					label="Today"
					selected={journeyDate === isoDay()}
					onPress={() => setJourneyDate(isoDay())}
				/>
				<Choice
					label="Yesterday"
					selected={journeyDate === isoDay(-1)}
					onPress={() => setJourneyDate(isoDay(-1))}
				/>
			</View>
			<Pressable
				onPress={() => setShowDatePicker(true)}
				className="flex-row items-center justify-between border-2 border-foreground bg-background px-4 py-4"
			>
				<Text className="font-black text-foreground">
					{new Date(`${journeyDate}T12:00:00`).toLocaleDateString(undefined, {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</Text>
				<Ionicons name="calendar-outline" size={21} />
			</Pressable>
			{showDatePicker && (
				<View className="mt-2 border-2 border-foreground bg-background p-2">
					<DateTimePicker
						value={new Date(`${journeyDate}T12:00:00`)}
						mode="date"
						display={Platform.OS === "ios" ? "inline" : "default"}
						minimumDate={
							detail.data?.group.startDate
								? new Date(`${detail.data.group.startDate}T12:00:00`)
								: undefined
						}
						maximumDate={new Date()}
						onChange={(_, date) => {
							if (Platform.OS === "android") setShowDatePicker(false);
							if (date) setJourneyDate(dateToIso(date));
						}}
					/>
					{Platform.OS === "ios" && (
						<Pressable
							onPress={() => setShowDatePicker(false)}
							className="border-2 border-black bg-[#c8f55a] p-3"
						>
							<Text className="text-center font-black text-black">Done</Text>
						</Pressable>
					)}
				</View>
			)}
			<Step number={3} title="Route" />
			<View className="flex-row gap-2">
				<Choice
					label="One way"
					selected={!twoWay}
					onPress={() => {
						setTwoWay(false);
						setDistance("");
					}}
				/>
				<Choice
					label="Return"
					selected={twoWay}
					onPress={() => {
						setTwoWay(true);
						setDistance("");
					}}
				/>
			</View>
			<Text className="mt-4 mb-2 font-bold text-foreground text-xs">
				DISTANCE (KM)
			</Text>
			<TextInput
				value={distance || String(km || "")}
				onChangeText={setDistance}
				keyboardType="decimal-pad"
				className="border-2 border-foreground bg-background px-4 py-4 text-foreground"
			/>
			<Step number={4} title="Who joined?" />
			<View className="flex-row flex-wrap gap-2">
				{detail.data?.people
					.filter((item) => item.isActive)
					.map((item) => (
						<Pressable
							key={item.id}
							onPress={() =>
								setPeople((old) =>
									old.includes(item.id)
										? old.filter((id) => id !== item.id)
										: [...old, item.id],
								)
							}
							className={`flex-row items-center border-2 border-foreground px-4 py-3 ${people.includes(item.id) ? "bg-[#c8f55a]" : "bg-background"}`}
						>
							{people.includes(item.id) && (
								<Ionicons name="checkmark" size={16} />
							)}
							<Text
								className={`font-black ${people.includes(item.id) ? "text-black" : "text-foreground"}`}
							>
								{" "}
								{item.name}
							</Text>
						</Pressable>
					))}
			</View>
			{detail.data && !detail.data.people.length && (
				<Text className="text-muted">
					Add a partner from the Trips tab first.
				</Text>
			)}
			<Step number={5} title="Fuel price" />
			<View
				className="border-2 border-foreground bg-[#8dc8ff] p-4"
				style={hardShadow}
			>
				<View className="flex-row items-center">
					<Ionicons name="flame-outline" size={22} color="#111" />
					<View className="ml-3 flex-1">
						<Text className="font-black text-black">
							{detail.data?.group.fuelDistrict || "Selected city"}{" "}
							{detail.data?.group.fuelType || "fuel"}
						</Text>
						<Text className="text-black text-sm">
							{price
								? `${formatRupees(price)} / litre`
								: "Fetch the current price"}
						</Text>
					</View>
					<Pressable
						disabled={!currentId || fuel.isFetching}
						onPress={fetchPrice}
						className="border-2 border-black bg-[#c8f55a] px-3 py-2 disabled:opacity-40"
					>
						<Text className="font-black text-black">
							{fuel.isFetching ? "Loading…" : "Fetch"}
						</Text>
					</Pressable>
				</View>
				{fuel.error && (
					<Text className="mt-3 text-red-800 text-sm">
						{fuel.error.message}
					</Text>
				)}
				<Pressable onPress={() => setShowManual((value) => !value)}>
					<Text className="mt-3 font-black text-black underline">
						{showManual ? "Hide manual entry" : "Enter price manually"}
					</Text>
				</Pressable>
				{showManual && (
					<TextInput
						placeholder="Manual ₹ / litre"
						placeholderTextColor="#666"
						value={manual}
						onChangeText={(value) => {
							setManual(value);
							setPrice(Math.round(Number(value) * 100));
							setQuote(undefined);
						}}
						keyboardType="decimal-pad"
						className="mt-3 border-2 border-black bg-white px-4 py-3 text-black"
					/>
				)}
			</View>
			{cost && (
				<View
					className="mt-4 flex-row border-2 border-foreground bg-[#ff9fb2] p-5"
					style={hardShadow}
				>
					<View className="flex-1">
						<Text className="font-black text-black text-xs">TOTAL</Text>
						<Text className="font-black text-2xl text-black">
							{formatRupees(cost.fuelCostPaise)}
						</Text>
					</View>
					<View className="flex-1">
						<Text className="font-black text-black text-xs">PER PERSON</Text>
						<Text className="font-black text-2xl text-black">
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
						journeyDate,
						direction: twoWay ? "two_way" : "one_way",
						distanceKm: km,
						participantIds: people,
						petrolPricePaise: price,
						petrolPriceSource: quote ? "mypetrolprice" : "manual",
						fuelQuoteToken: quote,
					})
				}
				className="mt-5 mb-8 border-2 border-foreground bg-[#c8f55a] p-5 disabled:opacity-40"
				style={hardShadow}
			>
				<Text className="text-center font-black text-black text-lg">
					{save.isPending ? "Saving…" : "Save ride"}
				</Text>
			</Pressable>
		</Container>
	);
}

function Choice({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className={`flex-1 border-2 border-foreground p-4 ${selected ? "bg-[#8dc8ff]" : "bg-background"}`}
		>
			<Text
				className={`text-center font-black ${selected ? "text-black" : "text-foreground"}`}
			>
				{label}
			</Text>
		</Pressable>
	);
}
