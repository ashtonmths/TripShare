import type { AppRouter } from "@TripShare/api/routers/index";
import { formatRupees } from "@TripShare/shared";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { router } from "expo-router";
import { useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { queryClient, trpc } from "@/utils/trpc";

const today = () => new Date().toISOString().slice(0, 10);
type Mode = "group" | "person" | "payment" | "settings";
type Detail = inferRouterOutputs<AppRouter>["groups"]["detail"];

function Field({
	label,
	value,
	onChange,
	keyboardType = "default",
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	keyboardType?: "default" | "email-address" | "decimal-pad";
	placeholder?: string;
}) {
	return (
		<View className="gap-2">
			<Text className="font-black text-foreground text-sm">{label}</Text>
			<TextInput
				value={value}
				onChangeText={onChange}
				keyboardType={keyboardType}
				autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
				placeholder={placeholder}
				placeholderTextColor="#777"
				className="border-2 border-foreground bg-background px-4 py-3 text-foreground"
			/>
		</View>
	);
}

function Empty({ text }: { text: string }) {
	return (
		<View className="items-center border-2 border-foreground border-dashed p-8">
			<Ionicons name="car-outline" size={30} />
			<Text className="mt-3 text-center text-muted">{text}</Text>
		</View>
	);
}

export default function Trips() {
	const { data: session } = authClient.useSession();
	const groups = useQuery({
		...trpc.groups.list.queryOptions(),
		enabled: Boolean(session),
	});
	const [selected, setSelected] = useState<string>();
	const groupId = selected ?? groups.data?.[0]?.id;
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(session && groupId),
	});
	const [mode, setMode] = useState<Mode>();
	const refresh = async () => {
		await queryClient.invalidateQueries();
		setMode(undefined);
	};

	if (!session)
		return (
			<Container className="px-5 pt-8">
				<Text className="font-black text-3xl text-foreground">
					Sign in first
				</Text>
				<Text className="mt-2 text-muted">
					Your private and shared trips appear after Google sign-in.
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
			<View className="flex-row items-start justify-between gap-3">
				<View className="flex-1">
					<Text className="font-black text-3xl text-foreground">Trips</Text>
					<Text className="mt-1 text-muted">
						People, balances, rides and settings.
					</Text>
				</View>
				<Pressable
					accessibilityLabel="Create trip"
					onPress={() => setMode("group")}
					className="h-12 w-12 items-center justify-center border-2 border-foreground bg-[#c8f55a]"
					style={hardShadow}
				>
					<Ionicons name="add" size={25} color="#111" />
				</Pressable>
			</View>
			{groups.isLoading ? (
				<Text className="mt-8 text-muted">Loading your trips…</Text>
			) : !groups.data?.length ? (
				<View className="mt-6">
					<Empty text="Create your first trip here. You no longer need the website to get started." />
				</View>
			) : (
				<View className="mt-5 flex-row flex-wrap gap-2">
					{groups.data.map((item) => (
						<Pressable
							key={item.id}
							onPress={() => setSelected(item.id)}
							className={`border-2 border-foreground px-4 py-3 ${groupId === item.id ? "bg-[#8dc8ff]" : "bg-background"}`}
						>
							<Text className="font-black text-foreground">{item.name}</Text>
						</Pressable>
					))}
				</View>
			)}
			{detail.isLoading && (
				<Text className="mt-8 text-muted">Loading trip…</Text>
			)}
			{detail.data && (
				<>
					<View
						className="mt-5 border-2 border-foreground bg-[#8dc8ff] p-5"
						style={hardShadow}
					>
						<Text className="font-black text-2xl text-black">
							{detail.data.group.name}
						</Text>
						<Text className="mt-1 text-black">
							{detail.data.group.vehicleName} · {detail.data.group.mileageKmpl}{" "}
							km/l
						</Text>
						<Text className="mt-1 text-black">
							{detail.data.group.normalOneWayKm} km one way ·{" "}
							{detail.data.group.fuelType}
						</Text>
					</View>
					<View className="mt-4 flex-row flex-wrap gap-2">
						<Action
							icon="person-add-outline"
							label="Partner"
							onPress={() => setMode("person")}
						/>
						<Action
							icon="cash-outline"
							label="Payment"
							onPress={() => setMode("payment")}
						/>
						<Action
							icon="settings-outline"
							label="Settings"
							onPress={() => setMode("settings")}
						/>
						<Action
							icon="add-circle-outline"
							label="Add ride"
							onPress={() => router.push("/(drawer)/(tabs)/two")}
						/>
					</View>
					<SectionTitle title="Balances" />
					{!detail.data.people.length ? (
						<Empty text="Add a partner to start splitting rides." />
					) : (
						detail.data.people.map((member) => {
							const balance = detail.data.balances.find(
								(item) => item.personId === member.id,
							);
							const due = balance?.balancePaise ?? 0;
							return (
								<View
									key={member.id}
									className="mb-2 flex-row items-center border-2 border-foreground bg-background p-4"
								>
									<View className="mr-3 h-10 w-10 items-center justify-center border-2 border-foreground bg-[#ff9fb2]">
										<Text className="font-black text-black">
											{member.name.slice(0, 1).toUpperCase()}
										</Text>
									</View>
									<View className="flex-1">
										<Text className="font-black text-foreground">
											{member.name}
										</Text>
										<Text className="text-muted text-xs">
											{member.email ?? "Email not set"} ·{" "}
											{formatRupees(balance?.paidPaise ?? 0)} paid
										</Text>
									</View>
									<Text className="font-black text-foreground">
										{due <= 0 ? "Settled" : formatRupees(due)}
									</Text>
								</View>
							);
						})
					)}
					{detail.data.corrections.some(
						(item) => item.status === "pending",
					) && (
						<>
							<SectionTitle title="Corrections" />
							{detail.data.corrections
								.filter((item) => item.status === "pending")
								.map((item) => (
									<Correction
										key={item.id}
										groupId={detail.data.group.id}
										item={item}
										onDone={refresh}
									/>
								))}
						</>
					)}
					<SectionTitle title="Journey history" />
					{!detail.data.journeys.length ? (
						<Empty text="No rides recorded yet." />
					) : (
						detail.data.journeys.map((ride) => (
							<View
								key={ride.id}
								className="mb-2 border-2 border-foreground bg-background p-4"
							>
								<View className="flex-row justify-between">
									<Text className="font-black text-foreground">
										{ride.journeyDate}
									</Text>
									<Text className="font-black text-foreground">
										{formatRupees(ride.fuelCostPaise)}
									</Text>
								</View>
								<Text className="mt-1 text-muted text-sm">
									{ride.direction === "two_way" ? "Return" : "One way"} ·{" "}
									{ride.distanceKm} km
								</Text>
								<Text className="mt-1 text-muted text-xs">
									{ride.participants.map((item) => item.name).join(", ")}
								</Text>
							</View>
						))
					)}
				</>
			)}
			{mode && (
				<Editor
					mode={mode}
					groupId={groupId}
					data={detail.data}
					close={() => setMode(undefined)}
					saved={refresh}
				/>
			)}
		</Container>
	);
}

function Action({
	icon,
	label,
	onPress,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="min-w-[46%] flex-1 flex-row items-center justify-center gap-2 border-2 border-foreground bg-background p-3"
		>
			<Ionicons name={icon} size={18} />
			<Text className="font-black text-foreground">{label}</Text>
		</Pressable>
	);
}
function SectionTitle({ title }: { title: string }) {
	return (
		<Text className="mt-7 mb-3 font-black text-foreground text-xl">
			{title}
		</Text>
	);
}

function Correction({
	groupId,
	item,
	onDone,
}: {
	groupId: string;
	item: { id: string; personName: string; note: string | null };
	onDone: () => Promise<void>;
}) {
	const resolve = useMutation(
		trpc.corrections.resolve.mutationOptions({
			onSuccess: onDone,
			onError: (error) => Alert.alert("Couldn’t update", error.message),
		}),
	);
	return (
		<View className="mb-3 border-2 border-foreground bg-[#ff9fb2] p-4">
			<Text className="font-black text-black">{item.personName}</Text>
			<Text className="mt-1 text-black">
				{item.note || "Says they did not join this ride."}
			</Text>
			<View className="mt-3 flex-row gap-2">
				<Pressable
					className="flex-1 border-2 border-black bg-[#c8f55a] p-3"
					onPress={() =>
						resolve.mutate({
							groupId,
							correctionId: item.id,
							status: "approved",
						})
					}
				>
					<Text className="text-center font-black text-black">Approve</Text>
				</Pressable>
				<Pressable
					className="flex-1 border-2 border-black bg-white p-3"
					onPress={() =>
						resolve.mutate({
							groupId,
							correctionId: item.id,
							status: "rejected",
						})
					}
				>
					<Text className="text-center font-black text-black">Reject</Text>
				</Pressable>
			</View>
		</View>
	);
}

function Editor({
	mode,
	groupId,
	data,
	close,
	saved,
}: {
	mode: Mode;
	groupId?: string;
	data?: Detail;
	close: () => void;
	saved: () => Promise<void>;
}) {
	const group = data?.group;
	const [form, setForm] = useState<Record<string, string>>({
		startDate: today(),
		paidOn: today(),
		method: "upi",
		mileage: group?.mileageKmpl ?? "",
		distance: group?.normalOneWayKm ?? "",
		fuelType: group?.fuelType ?? "petrol",
		fuelState: group?.fuelState ?? "Karnataka",
		fuelDistrict: group?.fuelDistrict ?? "",
		fuelLocationId: String(group?.fuelLocationId ?? ""),
	});
	const set = (key: string, value: string) =>
		setForm((old) => ({ ...old, [key]: value }));
	const callbacks = {
		onSuccess: saved,
		onError: (error: { message: string }) =>
			Alert.alert("Couldn’t save", error.message),
	};
	const createGroup = useMutation(
		trpc.groups.create.mutationOptions(callbacks),
	);
	const addPerson = useMutation(trpc.people.add.mutationOptions(callbacks));
	const addPayment = useMutation(
		trpc.payments.create.mutationOptions(callbacks),
	);
	const settings = useMutation(
		trpc.groups.updateSettings.mutationOptions(callbacks),
	);
	const states = useQuery({
		...trpc.fuel.states.queryOptions(),
		enabled: mode === "settings",
		staleTime: 86_400_000,
	});
	const [stateChoice, setStateChoice] = useState<{
		id: number;
		slug: string;
		name: string;
	}>();
	const activeState =
		stateChoice ?? states.data?.find((item) => item.name === form.fuelState);
	const districts = useQuery({
		...trpc.fuel.districts.queryOptions({
			stateId: activeState?.id ?? 1,
			stateSlug: activeState?.slug ?? "India",
		}),
		enabled: mode === "settings" && Boolean(activeState),
		staleTime: 86_400_000,
	});
	const busy =
		createGroup.isPending ||
		addPerson.isPending ||
		addPayment.isPending ||
		settings.isPending;
	const submit = () => {
		if (mode === "group")
			createGroup.mutate({
				name: form.name ?? "",
				vehicleName: form.vehicle ?? "",
				mileageKmpl: Number(form.mileage),
				normalOneWayKm: Number(form.distance),
				startDate: form.startDate,
			});
		if (mode === "person" && groupId)
			addPerson.mutate({
				groupId,
				name: form.name ?? "",
				email: form.email ?? "",
				phone: form.phone,
			});
		if (mode === "payment" && groupId)
			addPayment.mutate({
				groupId,
				personId: form.personId ?? "",
				amountPaise: Math.round(Number(form.amount) * 100),
				method: form.method as "upi" | "cash" | "bank_transfer" | "other",
				paidOn: form.paidOn,
				note: form.note,
			});
		if (mode === "settings" && groupId)
			settings.mutate({
				groupId,
				mileageKmpl: Number(form.mileage),
				normalOneWayKm: Number(form.distance),
				fuelType: form.fuelType as "petrol" | "diesel",
				fuelState: form.fuelState,
				fuelDistrict: form.fuelDistrict,
				fuelLocationId: Number(form.fuelLocationId),
			});
	};
	return (
		<View
			className="mt-6 border-2 border-foreground bg-[#f5f2e8] p-4"
			style={hardShadow}
		>
			<View className="mb-4 flex-row items-center justify-between">
				<Text className="font-black text-2xl text-black">
					{mode === "group"
						? "New trip"
						: mode === "person"
							? "Add partner"
							: mode === "payment"
								? "Record payment"
								: "Trip settings"}
				</Text>
				<Pressable
					onPress={close}
					className="h-10 w-10 items-center justify-center border-2 border-black bg-white"
				>
					<Ionicons name="close" size={22} />
				</Pressable>
			</View>
			<View className="gap-4">
				{mode === "group" && (
					<>
						<Field
							label="Trip name"
							value={form.name ?? ""}
							onChange={(v) => set("name", v)}
							placeholder="Office carpool"
						/>
						<Field
							label="Vehicle"
							value={form.vehicle ?? ""}
							onChange={(v) => set("vehicle", v)}
							placeholder="Car name"
						/>
						<Field
							label="Mileage (km/l)"
							value={form.mileage ?? ""}
							onChange={(v) => set("mileage", v)}
							keyboardType="decimal-pad"
						/>
						<Field
							label="One-way distance (km)"
							value={form.distance ?? ""}
							onChange={(v) => set("distance", v)}
							keyboardType="decimal-pad"
						/>
						<Field
							label="Tracking starts (YYYY-MM-DD)"
							value={form.startDate}
							onChange={(v) => set("startDate", v)}
						/>
					</>
				)}
				{mode === "person" && (
					<>
						<Field
							label="Name"
							value={form.name ?? ""}
							onChange={(v) => set("name", v)}
						/>
						<Field
							label="Google account email"
							value={form.email ?? ""}
							onChange={(v) => set("email", v)}
							keyboardType="email-address"
						/>
						<Field
							label="Phone (optional)"
							value={form.phone ?? ""}
							onChange={(v) => set("phone", v)}
						/>
						<Text className="text-black text-sm">
							This email automatically receives read-only access after Google
							sign-in.
						</Text>
					</>
				)}
				{mode === "payment" && (
					<>
						<Text className="font-black text-black text-sm">Partner</Text>
						<View className="flex-row flex-wrap gap-2">
							{data?.people.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => set("personId", item.id)}
									className={`border-2 border-black px-3 py-2 ${form.personId === item.id ? "bg-[#8dc8ff]" : "bg-white"}`}
								>
									<Text className="font-bold text-black">{item.name}</Text>
								</Pressable>
							))}
						</View>
						<Field
							label="Amount (₹)"
							value={form.amount ?? ""}
							onChange={(v) => set("amount", v)}
							keyboardType="decimal-pad"
						/>
						<Text className="font-black text-black text-sm">Method</Text>
						<View className="flex-row flex-wrap gap-2">
							{["upi", "cash", "bank_transfer", "other"].map((value) => (
								<Pressable
									key={value}
									onPress={() => set("method", value)}
									className={`border-2 border-black px-3 py-2 ${form.method === value ? "bg-[#c8f55a]" : "bg-white"}`}
								>
									<Text className="font-bold text-black">
										{value.replace("_", " ")}
									</Text>
								</Pressable>
							))}
						</View>
						<Field
							label="Paid on (YYYY-MM-DD)"
							value={form.paidOn}
							onChange={(v) => set("paidOn", v)}
						/>
						<Field
							label="Note (optional)"
							value={form.note ?? ""}
							onChange={(v) => set("note", v)}
						/>
					</>
				)}
				{mode === "settings" && (
					<>
						<Field
							label="Mileage (km/l)"
							value={form.mileage}
							onChange={(v) => set("mileage", v)}
							keyboardType="decimal-pad"
						/>
						<Field
							label="One-way distance (km)"
							value={form.distance}
							onChange={(v) => set("distance", v)}
							keyboardType="decimal-pad"
						/>
						<Text className="font-black text-black text-sm">Fuel</Text>
						<View className="flex-row gap-2">
							{["petrol", "diesel"].map((value) => (
								<Pressable
									key={value}
									onPress={() => set("fuelType", value)}
									className={`flex-1 border-2 border-black p-3 ${form.fuelType === value ? "bg-[#c8f55a]" : "bg-white"}`}
								>
									<Text className="text-center font-black text-black">
										{value}
									</Text>
								</Pressable>
							))}
						</View>
						<Text className="font-black text-black text-sm">State</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerClassName="gap-2"
						>
							{states.data?.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => {
										setStateChoice(item);
										set("fuelState", item.name);
										set("fuelDistrict", "");
									}}
									className={`border-2 border-black px-3 py-2 ${form.fuelState === item.name ? "bg-[#8dc8ff]" : "bg-white"}`}
								>
									<Text className="font-bold text-black text-xs">
										{item.name}
									</Text>
								</Pressable>
							))}
						</ScrollView>
						<Text className="font-black text-black text-sm">
							District / city
						</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerClassName="gap-2"
						>
							{districts.data?.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => {
										set("fuelDistrict", item.name);
										set("fuelLocationId", String(item.id));
									}}
									className={`border-2 border-black px-3 py-2 ${form.fuelDistrict === item.name ? "bg-[#ff9fb2]" : "bg-white"}`}
								>
									<Text className="font-bold text-black text-xs">
										{item.name}
									</Text>
								</Pressable>
							))}
						</ScrollView>
					</>
				)}
				<Pressable
					disabled={busy}
					onPress={submit}
					className="mt-2 border-2 border-black bg-[#c8f55a] p-4 disabled:opacity-40"
					style={hardShadow}
				>
					<Text className="text-center font-black text-black">
						{busy ? "Saving…" : "Save"}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}
