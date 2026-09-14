import type { AppRouter } from "@TripShare/api/routers/index";
import { formatRupees } from "@TripShare/shared";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { Container } from "@/components/container";
import { useObserveReady } from "@/hooks/use-observe-ready";
import { authClient } from "@/lib/auth-client";
import { hardShadow } from "@/lib/neobrutalism";
import { queryClient, trpc } from "@/utils/trpc";

const today = () => new Date().toISOString().slice(0, 10);
const dateToIso = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
type Mode = "group" | "person" | "payment" | "settings";
type Detail = inferRouterOutputs<AppRouter>["groups"]["detail"];
type SharedDetail = inferRouterOutputs<AppRouter>["sharedTrips"]["detail"];

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

function DateField({
	label,
	value,
	onChange,
	minimumDate,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	minimumDate?: string;
}) {
	const [open, setOpen] = useState(false);
	const foreground = useThemeColor("foreground");
	return (
		<View className="gap-2">
			<Text className="font-black text-foreground text-sm">{label}</Text>
			<Pressable
				onPress={() => setOpen(true)}
				className="flex-row items-center justify-between border-2 border-foreground bg-background px-4 py-3"
			>
				<Text className="font-bold text-foreground">
					{new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</Text>
				<Ionicons name="calendar-outline" size={20} color={foreground} />
			</Pressable>
			{open && (
				<DateTimePicker
					value={new Date(`${value}T12:00:00`)}
					mode="date"
					display={Platform.OS === "ios" ? "inline" : "default"}
					minimumDate={
						minimumDate ? new Date(`${minimumDate}T12:00:00`) : undefined
					}
					maximumDate={new Date()}
					onChange={(_, date) => {
						if (Platform.OS === "android") setOpen(false);
						if (date) onChange(dateToIso(date));
					}}
				/>
			)}
			{open && Platform.OS === "ios" && (
				<Pressable
					onPress={() => setOpen(false)}
					className="border-2 border-black bg-[#c8f55a] p-3"
				>
					<Text className="text-center font-black text-black">Done</Text>
				</Pressable>
			)}
		</View>
	);
}

function SelectField({
	label,
	value,
	onChange,
	items,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	items: Array<{ label: string; value: string }>;
}) {
	const foreground = useThemeColor("foreground");
	const background = useThemeColor("background");
	return (
		<View className="gap-2">
			<Text className="font-black text-foreground text-sm">{label}</Text>
			<View className="border-2 border-foreground bg-background">
				<Picker
					selectedValue={value}
					onValueChange={(next) => onChange(String(next))}
					style={{ color: foreground, backgroundColor: background }}
					dropdownIconColor={foreground}
				>
					{items.map((item) => (
						<Picker.Item
							key={item.value}
							label={item.label}
							value={item.value}
						/>
					))}
				</Picker>
			</View>
		</View>
	);
}

function SharedTripDetail({ data }: { data: SharedDetail }) {
	const [paying, setPaying] = useState(false);
	const correction = useMutation(
		trpc.sharedTrips.raiseCorrection.mutationOptions({
			onSuccess: async () => {
				Alert.alert("Sent", "The owner will review your attendance dispute.");
				await queryClient.invalidateQueries();
			},
			onError: (error) => Alert.alert("Couldn’t send", error.message),
		}),
	);
	const remaining = Number(data.owedPaise) - Number(data.paidPaise);
	return (
		<View className="mt-5">
			<View
				className="border-2 border-foreground bg-[#c8f55a] p-5"
				style={hardShadow}
			>
				<Text className="font-black text-2xl text-black">{data.groupName}</Text>
				<Text className="mt-1 text-black">
					{data.vehicleName} · added as {data.personName}
				</Text>
				<View className="mt-4 border-black border-t-2 pt-4">
					<Text className="font-black text-black text-xs">PAY TO</Text>
					<Text className="font-black text-black text-lg">
						{data.ownerName}
					</Text>
					<Text className="text-black">{data.ownerEmail}</Text>
					<Text className="mt-3 font-black text-3xl text-black">
						{formatRupees(Math.max(0, remaining))}
					</Text>
					<Text className="text-black text-sm">
						remaining · {formatRupees(Number(data.pendingPaymentPaise))}{" "}
						awaiting approval
					</Text>
				</View>
				<Pressable
					onPress={() => setPaying(true)}
					className="mt-4 flex-row items-center justify-center gap-2 border-2 border-black bg-white p-3"
				>
					<Ionicons name="checkmark-circle-outline" size={19} color="#111" />
					<Text className="font-black text-black">Mark payment sent</Text>
				</Pressable>
			</View>
			<SectionTitle title="My attendance" />
			{!data.journeys.length ? (
				<Empty text="No attendance recorded for you." />
			) : (
				data.journeys.map((ride) => (
					<View
						key={ride.id}
						className="mb-2 border-2 border-foreground bg-background p-4"
					>
						<View className="flex-row justify-between">
							<Text className="font-black text-foreground">
								{ride.journeyDate}
							</Text>
							<Text className="font-black text-foreground">
								{formatRupees(ride.sharePaise)}
							</Text>
						</View>
						<Text className="mt-1 text-muted">
							{ride.direction === "two_way" ? "Return" : "One way"} ·{" "}
							{ride.distanceKm} km
						</Text>
						{ride.correctionStatus ? (
							<Text className="mt-2 font-bold text-foreground">
								Dispute {ride.correctionStatus}
							</Text>
						) : (
							<Pressable
								onPress={() =>
									Alert.alert(
										"Raise dispute?",
										"Tell the owner you did not join this ride.",
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
								className="mt-3 border-2 border-foreground bg-[#ff9fb2] p-3"
							>
								<Text className="text-center font-black text-black">
									I wasn’t on this ride
								</Text>
							</Pressable>
						)}
					</View>
				))
			)}
			{paying && (
				<PaymentClaim groupId={data.groupId} close={() => setPaying(false)} />
			)}
		</View>
	);
}

function PaymentClaim({
	groupId,
	close,
}: {
	groupId: string;
	close: () => void;
}) {
	const [amount, setAmount] = useState("");
	const [method, setMethod] = useState<
		"upi" | "cash" | "bank_transfer" | "other"
	>("upi");
	const [paidOn, setPaidOn] = useState(today());
	const claim = useMutation(
		trpc.sharedTrips.claimPayment.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				close();
				Alert.alert(
					"Sent for approval",
					"The owner will confirm this payment.",
				);
			},
			onError: (error) => Alert.alert("Couldn’t submit", error.message),
		}),
	);
	return (
		<Modal transparent animationType="slide" onRequestClose={close}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1 justify-end bg-black/60"
			>
				<View className="border-2 border-foreground bg-background p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-black text-2xl text-foreground">
							Mark as paid
						</Text>
						<Pressable
							onPress={close}
							className="h-10 w-10 items-center justify-center border-2 border-foreground bg-background"
						>
							<Ionicons name="close" size={21} />
						</Pressable>
					</View>
					<Text className="mt-2 text-foreground">
						The owner must approve before your balance changes.
					</Text>
					<View className="mt-5">
						<Field
							label="Amount (₹)"
							value={amount}
							onChange={setAmount}
							keyboardType="decimal-pad"
						/>
					</View>
					<View className="mt-4 gap-4">
						<SelectField
							label="Method"
							value={method}
							onChange={(value) => setMethod(value as typeof method)}
							items={[
								{ label: "UPI", value: "upi" },
								{ label: "Cash", value: "cash" },
								{ label: "Bank transfer", value: "bank_transfer" },
								{ label: "Other", value: "other" },
							]}
						/>
						<DateField label="Paid on" value={paidOn} onChange={setPaidOn} />
					</View>
					<Pressable
						disabled={!Number(amount) || claim.isPending}
						onPress={() =>
							claim.mutate({
								groupId,
								amountPaise: Math.round(Number(amount) * 100),
								method,
								paidOn,
							})
						}
						className="mt-5 border-2 border-black bg-[#c8f55a] p-4 disabled:opacity-40"
						style={hardShadow}
					>
						<Text className="text-center font-black text-black">
							{claim.isPending ? "Sending…" : "Send for approval"}
						</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</Modal>
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
	const shared = useQuery({
		...trpc.sharedTrips.list.queryOptions(),
		enabled: Boolean(session),
	});
	const [selected, setSelected] = useState<string>();
	const [sharedSelected, setSharedSelected] = useState<string>();
	const groupId = sharedSelected
		? undefined
		: (selected ?? groups.data?.[0]?.id);
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(session && groupId),
	});
	const sharedDetail = useQuery({
		...trpc.sharedTrips.detail.queryOptions({ groupId: sharedSelected ?? "" }),
		enabled: Boolean(session && sharedSelected),
	});
	const [mode, setMode] = useState<Mode>();
	const [editingPersonId, setEditingPersonId] = useState<string>();
	useObserveReady(
		Boolean(session) &&
			!groups.isLoading &&
			!shared.isLoading &&
			(!groupId || !detail.isLoading) &&
			(!sharedSelected || !sharedDetail.isLoading),
	);
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
			<SectionTitle title="All trips" />
			{groups.isLoading || shared.isLoading ? (
				<Text className="text-muted">Loading trips…</Text>
			) : !groups.data?.length && !shared.data?.length ? (
				<Empty text="Create a trip or ask an owner to add your Google email." />
			) : (
				<View className="flex-row flex-wrap gap-2">
					{groups.data?.map((item) => (
						<Pressable
							key={item.id}
							onPress={() => {
								setSelected(item.id);
								setSharedSelected(undefined);
							}}
							className={`border-2 border-foreground px-4 py-3 ${groupId === item.id ? "bg-[#8dc8ff]" : "bg-background"}`}
						>
							<Text
								className={`font-black ${groupId === item.id ? "text-black" : "text-foreground"}`}
							>
								{item.name}
							</Text>
							<Text
								className={`text-xs ${groupId === item.id ? "text-black" : "text-muted"}`}
							>
								Owner
							</Text>
						</Pressable>
					))}
					{shared.data?.map((item) => (
						<Pressable
							key={item.groupId}
							onPress={() => setSharedSelected(item.groupId)}
							className={`border-2 border-foreground px-4 py-3 ${sharedSelected === item.groupId ? "bg-[#c8f55a]" : "bg-background"}`}
						>
							<Text
								className={`font-black ${sharedSelected === item.groupId ? "text-black" : "text-foreground"}`}
							>
								{item.groupName}
							</Text>
							<Text
								className={`text-xs ${sharedSelected === item.groupId ? "text-black" : "text-muted"}`}
							>
								Read only
							</Text>
						</Pressable>
					))}
				</View>
			)}
			{sharedDetail.data && <SharedTripDetail data={sharedDetail.data} />}
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
							label="Add person"
							onPress={() => {
								setEditingPersonId(undefined);
								setMode("person");
							}}
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
					</View>
					<SectionTitle title="Balances" />
					{!detail.data.people.length ? (
						<Empty text="Add a person to start splitting rides." />
					) : (
						<View className="border-2 border-foreground bg-background p-2">
							{detail.data.people.map((member) => {
								const balance = detail.data.balances.find(
									(item) => item.personId === member.id,
								);
								const due = balance?.balancePaise ?? 0;
								return (
									<Pressable
										key={member.id}
										onPress={() => {
											setEditingPersonId(member.id);
											setMode("person");
										}}
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
									</Pressable>
								);
							})}
						</View>
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
					{detail.data.paymentClaims.some(
						(item) => item.status === "pending",
					) && (
						<>
							<SectionTitle title="Payment approvals" />
							{detail.data.paymentClaims
								.filter((item) => item.status === "pending")
								.map((item) => (
									<PaymentApproval
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
					editingPersonId={editingPersonId}
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
	const foreground = useThemeColor("foreground");
	return (
		<Pressable
			onPress={onPress}
			className="min-w-[46%] flex-1 flex-row items-center justify-center gap-2 border-2 border-foreground bg-background p-3"
		>
			<Ionicons name={icon} size={18} color={foreground} />
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

function PaymentApproval({
	groupId,
	item,
	onDone,
}: {
	groupId: string;
	item: {
		id: string;
		personName: string;
		amountPaise: number;
		method: string;
		paidOn: string;
	};
	onDone: () => Promise<void>;
}) {
	const resolve = useMutation(
		trpc.paymentClaims.resolve.mutationOptions({
			onSuccess: onDone,
			onError: (error) => Alert.alert("Couldn’t update", error.message),
		}),
	);
	return (
		<View className="mb-3 border-2 border-foreground bg-[#c8f55a] p-4">
			<View className="flex-row justify-between">
				<Text className="font-black text-black">
					{item.personName} marked paid
				</Text>
				<Text className="font-black text-black">
					{formatRupees(item.amountPaise)}
				</Text>
			</View>
			<Text className="mt-1 text-black text-sm">
				{item.method.replace("_", " ")} · {item.paidOn}
			</Text>
			<View className="mt-3 flex-row gap-2">
				<Pressable
					className="flex-1 border-2 border-black bg-white p-3"
					onPress={() =>
						resolve.mutate({ groupId, claimId: item.id, status: "approved" })
					}
				>
					<Text className="text-center font-black text-black">Approve</Text>
				</Pressable>
				<Pressable
					className="flex-1 border-2 border-black bg-[#ff9fb2] p-3"
					onPress={() =>
						resolve.mutate({ groupId, claimId: item.id, status: "rejected" })
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
	editingPersonId,
	close,
	saved,
}: {
	mode: Mode;
	groupId?: string;
	data?: Detail;
	editingPersonId?: string;
	close: () => void;
	saved: () => Promise<void>;
}) {
	const background = useThemeColor("background");
	const foreground = useThemeColor("foreground");
	const group = data?.group;
	const editingPerson = data?.people.find(
		(item) => item.id === editingPersonId,
	);
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
		name: editingPerson?.name ?? "",
		email: editingPerson?.email ?? "",
		phone: editingPerson?.phone ?? "",
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
	const updatePerson = useMutation(
		trpc.people.updateContact.mutationOptions(callbacks),
	);
	const addPayment = useMutation(
		trpc.payments.create.mutationOptions(callbacks),
	);
	const settings = useMutation(
		trpc.groups.updateSettings.mutationOptions(callbacks),
	);
	const states = useQuery({
		...trpc.fuel.states.queryOptions(),
		enabled: mode === "settings" || mode === "group",
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
		enabled: (mode === "settings" || mode === "group") && Boolean(activeState),
		staleTime: 86_400_000,
	});
	const busy =
		createGroup.isPending ||
		addPerson.isPending ||
		updatePerson.isPending ||
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
				fuelType: form.fuelType as "petrol" | "diesel",
				fuelState: form.fuelState,
				fuelDistrict: form.fuelDistrict,
				fuelLocationId: Number(form.fuelLocationId),
			});
		if (mode === "person" && groupId && editingPersonId)
			updatePerson.mutate({
				groupId,
				personId: editingPersonId,
				name: form.name ?? "",
				email: form.email,
				phone: form.phone,
			});
		else if (mode === "person" && groupId)
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
		<Modal transparent animationType="slide" onRequestClose={close}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1 justify-end bg-black/60"
			>
				<ScrollView
					className="max-h-[90%] border-2 p-4"
					style={{ backgroundColor: background, borderColor: foreground }}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View className="mb-4 flex-row items-center justify-between">
						<Text className="font-black text-2xl text-foreground">
							{mode === "group"
								? "New trip"
								: mode === "person"
									? editingPersonId
										? "Edit person"
										: "Add a person"
									: mode === "payment"
										? "Record payment"
										: "Trip settings"}
						</Text>
						<Pressable
							onPress={close}
							className="h-10 w-10 items-center justify-center border-2 border-foreground bg-background"
						>
							<Ionicons name="close" size={22} color={foreground} />
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
								<DateField
									label="Tracking start date"
									value={form.startDate}
									onChange={(v) => set("startDate", v)}
								/>
								<Text className="font-black text-foreground text-sm">
									Fuel type
								</Text>
								<View className="flex-row gap-2">
									{(["petrol", "diesel"] as const).map((value) => (
										<Pressable
											key={value}
											onPress={() => set("fuelType", value)}
											className={`flex-1 border-2 border-foreground p-3 ${form.fuelType === value ? "bg-[#c8f55a]" : "bg-background"}`}
										>
											<Text
												className={`text-center font-black ${form.fuelType === value ? "text-black" : "text-foreground"}`}
											>
												{value === "petrol" ? "Petrol" : "Diesel"}
											</Text>
										</Pressable>
									))}
								</View>
								<Text className="font-black text-foreground text-sm">
									State
								</Text>
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
												set("fuelLocationId", "");
											}}
											className={`border-2 border-foreground px-3 py-2 ${form.fuelState === item.name ? "bg-[#8dc8ff]" : "bg-background"}`}
										>
											<Text
												className={`font-bold text-xs ${form.fuelState === item.name ? "text-black" : "text-foreground"}`}
											>
												{item.name}
											</Text>
										</Pressable>
									))}
								</ScrollView>
								<Text className="font-black text-foreground text-sm">
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
											className={`border-2 border-foreground px-3 py-2 ${form.fuelDistrict === item.name ? "bg-[#ff9fb2]" : "bg-background"}`}
										>
											<Text
												className={`font-bold text-xs ${form.fuelDistrict === item.name ? "text-black" : "text-foreground"}`}
											>
												{item.name}
											</Text>
										</Pressable>
									))}
								</ScrollView>
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
									label="Google account email (optional)"
									value={form.email ?? ""}
									onChange={(v) => set("email", v)}
									keyboardType="email-address"
								/>
								<Field
									label="Phone (optional)"
									value={form.phone ?? ""}
									onChange={(v) => set("phone", v)}
								/>
								<Text className="text-foreground text-sm">
									This email automatically receives read-only access after
									Google sign-in.
								</Text>
							</>
						)}
						{mode === "payment" && (
							<>
								<SelectField
									label="Person"
									value={form.personId ?? ""}
									onChange={(value) => set("personId", value)}
									items={[
										{ label: "Select person", value: "" },
										...(data?.people.map((item) => ({
											label: item.name,
											value: item.id,
										})) ?? []),
									]}
								/>
								<Field
									label="Amount (₹)"
									value={form.amount ?? ""}
									onChange={(v) => set("amount", v)}
									keyboardType="decimal-pad"
								/>
								<SelectField
									label="Method"
									value={form.method}
									onChange={(value) => set("method", value)}
									items={[
										{ label: "UPI", value: "upi" },
										{ label: "Cash", value: "cash" },
										{ label: "Bank transfer", value: "bank_transfer" },
										{ label: "Other", value: "other" },
									]}
								/>
								<DateField
									label="Paid on"
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
								<Text className="font-black text-foreground text-sm">Fuel</Text>
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
								<Text className="font-black text-foreground text-sm">
									State
								</Text>
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
								<Text className="font-black text-foreground text-sm">
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
							disabled={
								busy ||
								(mode === "group" && !form.fuelLocationId) ||
								(mode === "payment" && !form.personId)
							}
							onPress={submit}
							className="mt-2 border-2 border-black bg-[#c8f55a] p-4 disabled:opacity-40"
							style={hardShadow}
						>
							<Text className="text-center font-black text-black">
								{busy ? "Saving…" : "Save"}
							</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
}
