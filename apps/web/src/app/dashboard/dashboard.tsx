"use client";

import type { AppRouter } from "@TripShare/api/routers/index";
import { calculateFuelCost, formatRupees } from "@TripShare/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
	Car,
	Check,
	Fuel,
	Plus,
	ReceiptIndianRupee,
	Settings,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

const today = () => new Date().toISOString().slice(0, 10);
const Field = ({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<div className="field">
		<span>{label}</span>
		{children}
	</div>
);

export default function Dashboard() {
	const groups = useQuery(trpc.groups.list.queryOptions());
	const summary = useQuery(trpc.dashboard.queryOptions());
	const shared = useQuery(trpc.sharedTrips.list.queryOptions());
	const [selected, setSelected] = useState<string>();
	const [sharedSelected, setSharedSelected] = useState<string>();
	const [panel, setPanel] = useState<Action>();
	const activeSharedId =
		sharedSelected ??
		(!groups.data?.length ? shared.data?.[0]?.groupId : undefined);
	const groupId = activeSharedId
		? undefined
		: (selected ?? groups.data?.[0]?.id);
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(groupId),
	});
	const sharedDetail = useQuery({
		...trpc.sharedTrips.detail.queryOptions({ groupId: activeSharedId ?? "" }),
		enabled: Boolean(activeSharedId),
	});
	const refresh = async () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.groups.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.dashboard.queryKey() }),
		]);

	if (groups.isLoading)
		return (
			<main className="app-shell">
				<div className="skeleton-block" />
			</main>
		);
	if (groups.error)
		return (
			<main className="app-shell">
				<div className="state-box">
					<h2>Couldn’t load your trips</h2>
					<p>{groups.error.message}</p>
					<button type="button" onClick={() => groups.refetch()}>
						Try again
					</button>
				</div>
			</main>
		);
	return (
		<main className="app-shell">
			<section className="dashboard-heading">
				<div>
					<p className="eyebrow">Your private carpool ledger</p>
					<h1>Good to have you back.</h1>
					<p>Track every shared ride and settle up without the spreadsheet.</p>
				</div>
				<button
					className="primary-button"
					type="button"
					onClick={() => setPanel("journey")}
					disabled={!groupId}
				>
					<Plus size={18} /> Add journey
				</button>
			</section>
			<section className="stats-grid">
				<div>
					<span>Outstanding</span>
					<strong>
						{formatRupees(
							(summary.data?.totalOwedPaise ?? 0) -
								(summary.data?.totalPaidPaise ?? 0),
						)}
					</strong>
					<small>Across all groups</small>
				</div>
				<div>
					<span>Collected</span>
					<strong>{formatRupees(summary.data?.totalPaidPaise ?? 0)}</strong>
					<small>Payments recorded</small>
				</div>
				<div>
					<span>Journeys</span>
					<strong>{summary.data?.journeyCount ?? 0}</strong>
					<small>{summary.data?.groupCount ?? 0} groups</small>
				</div>
			</section>
			<div className="workspace-grid">
				<aside className="groups-pane">
					<div className="section-title">
						<div>
							<p className="eyebrow">Trips</p>
							<h2>All trips</h2>
						</div>
						<button
							className="icon-button"
							aria-label="Create group"
							type="button"
							onClick={() => setPanel("group")}
						>
							<Plus size={18} />
						</button>
					</div>
					{!groups.data?.length && !shared.data?.length ? (
						<Empty
							icon={<Car />}
							text="Create a trip or ask an owner to add your Google email."
						/>
					) : (
						<>
							{groups.data?.map((item) => (
								<button
									type="button"
									key={item.id}
									className={`group-row ${groupId === item.id ? "active" : ""}`}
									onClick={() => {
										setSelected(item.id);
										setSharedSelected(undefined);
									}}
								>
									<span className="group-icon">
										<Car size={18} />
									</span>
									<span>
										<b>{item.name}</b>
										<small>{item.vehicleName} · Owner</small>
									</span>
								</button>
							))}
							{shared.data?.map((item) => (
								<button
									type="button"
									key={item.groupId}
									className={`group-row ${activeSharedId === item.groupId ? "active" : ""}`}
									onClick={() => setSharedSelected(item.groupId)}
								>
									<span className="group-icon shared">
										<Users size={18} />
									</span>
									<span>
										<b>{item.groupName}</b>
										<small>Read only</small>
									</span>
								</button>
							))}
						</>
					)}
				</aside>
				<section className="ledger-pane">
					{activeSharedId ? (
						sharedDetail.isLoading ? (
							<div className="skeleton-block" />
						) : sharedDetail.data ? (
							<SharedLedger data={sharedDetail.data} />
						) : null
					) : !groupId ? (
						<div className="state-box">
							<Car />
							<h2>No groups yet</h2>
							<p>Add a carpool group, then the people who ride with you.</p>
							<button type="button" onClick={() => setPanel("group")}>
								Create a group
							</button>
						</div>
					) : detail.isLoading ? (
						<div className="skeleton-block" />
					) : detail.data ? (
						<Ledger data={detail.data} act={setPanel} />
					) : null}
				</section>
			</div>
			{panel && (
				<Panel
					kind={panel}
					data={detail.data}
					groupId={groupId}
					close={() => setPanel(undefined)}
					saved={async () => {
						setPanel(undefined);
						await refresh();
					}}
				/>
			)}
		</main>
	);
}

type Detail = inferRouterOutputs<AppRouter>["groups"]["detail"];
type Action = "group" | "person" | "journey" | "payment" | "settings";
const Empty = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
	<div className="empty-small">
		{icon}
		<p>{text}</p>
	</div>
);

type SharedDetail = inferRouterOutputs<AppRouter>["sharedTrips"]["detail"];
function SharedLedger({ data }: { data: SharedDetail }) {
	const correction = useMutation(
		trpc.sharedTrips.raiseCorrection.mutationOptions({
			onSuccess: async () => {
				toast.success("Correction sent to the trip owner");
				await queryClient.invalidateQueries({
					queryKey: trpc.sharedTrips.detail.queryKey({ groupId: data.groupId }),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const claimPayment = useMutation(
		trpc.sharedTrips.claimPayment.mutationOptions({
			onSuccess: async () => {
				toast.success("Payment sent for owner approval");
				await queryClient.invalidateQueries({
					queryKey: trpc.sharedTrips.detail.queryKey({ groupId: data.groupId }),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remaining = Number(data.owedPaise) - Number(data.paidPaise);
	return (
		<>
			<div className="ledger-header">
				<div>
					<p className="eyebrow">Read-only trip</p>
					<h2>{data.groupName}</h2>
					<p>
						{data.vehicleName} · added as {data.personName}
					</p>
				</div>
				<button
					className="text-button"
					type="button"
					onClick={() => {
						const amount = window.prompt("Amount paid in rupees");
						if (amount && Number(amount) > 0)
							claimPayment.mutate({
								groupId: data.groupId,
								amountPaise: Math.round(Number(amount) * 100),
								method: "upi",
								paidOn: today(),
							});
					}}
				>
					<Check size={16} /> Mark payment sent
				</button>
			</div>
			<section className="shared-payment-summary">
				<div>
					<span>Pay to</span>
					<strong>{data.ownerName}</strong>
					<small>{data.ownerEmail}</small>
				</div>
				<div>
					<span>Remaining</span>
					<strong>{formatRupees(Math.max(0, remaining))}</strong>
					<small>
						{formatRupees(Number(data.pendingPaymentPaise))} awaiting approval
					</small>
				</div>
			</section>
			<section>
				<div className="section-title">
					<div>
						<p className="eyebrow">Journeys</p>
						<h3>My attendance</h3>
					</div>
				</div>
				{data.journeys.map((ride) => (
					<article className="journey-row" key={ride.id}>
						<span className="journey-copy">
							<b>{ride.journeyDate}</b>
							<small>
								{ride.direction === "two_way"
									? "Return journey"
									: "One-way journey"}{" "}
								· {ride.distanceKm} km · {formatRupees(ride.sharePaise)}
							</small>
						</span>
						{ride.correctionStatus ? (
							<strong>{ride.correctionStatus}</strong>
						) : (
							<button
								type="button"
								onClick={() =>
									correction.mutate({
										journeyId: ride.id,
										note: "I did not join this journey.",
									})
								}
							>
								I wasn’t there
							</button>
						)}
					</article>
				))}
				{!data.journeys.length && (
					<p className="muted">No attendance has been recorded for you.</p>
				)}
			</section>
		</>
	);
}

function Ledger({ data, act }: { data: Detail; act: (a: Action) => void }) {
	const balances = new Map(data.balances.map((b) => [b.personId, b]));
	const resolve = useMutation(
		trpc.corrections.resolve.mutationOptions({
			onSuccess: async () => {
				toast.success("Correction updated");
				await queryClient.invalidateQueries({
					queryKey: trpc.groups.detail.queryKey({ groupId: data.group.id }),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const resolvePayment = useMutation(
		trpc.paymentClaims.resolve.mutationOptions({
			onSuccess: async () => {
				toast.success("Payment updated");
				await queryClient.invalidateQueries({
					queryKey: trpc.groups.detail.queryKey({ groupId: data.group.id }),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<>
			<div className="ledger-header">
				<div>
					<p className="eyebrow">{data.group.vehicleName}</p>
					<h2>{data.group.name}</h2>
					<p>
						{data.group.normalOneWayKm} km usual one-way ·{" "}
						{data.group.mileageKmpl} km/l
					</p>
				</div>
				<div className="button-row">
					<button type="button" onClick={() => act("settings")}>
						<Settings size={16} /> Settings
					</button>
					<button type="button" onClick={() => act("person")}>
						<Users size={16} /> Add person
					</button>
					<button type="button" onClick={() => act("payment")}>
						<ReceiptIndianRupee size={16} /> Payment
					</button>
				</div>
			</div>
			<section>
				<div className="section-title">
					<div>
						<p className="eyebrow">Payments</p>
						<h3>Pending approval</h3>
					</div>
				</div>
				{data.paymentClaims
					.filter((item) => item.status === "pending")
					.map((item) => (
						<article className="journey-row" key={item.id}>
							<span className="journey-copy">
								<b>
									{item.personName} · {formatRupees(item.amountPaise)}
								</b>
								<small>
									{item.method.replace("_", " ")} · {item.paidOn}
								</small>
							</span>
							<span className="button-row">
								<button
									type="button"
									onClick={() =>
										resolvePayment.mutate({
											groupId: data.group.id,
											claimId: item.id,
											status: "approved",
										})
									}
								>
									Approve
								</button>
								<button
									type="button"
									onClick={() =>
										resolvePayment.mutate({
											groupId: data.group.id,
											claimId: item.id,
											status: "rejected",
										})
									}
								>
									Reject
								</button>
							</span>
						</article>
					))}
				{!data.paymentClaims.some((item) => item.status === "pending") && (
					<p className="muted">No pending payment claims.</p>
				)}
			</section>
			{data.corrections.some((item) => item.status === "pending") && (
				<section>
					<div className="section-title">
						<div>
							<p className="eyebrow">Corrections</p>
							<h3>Attendance requests</h3>
						</div>
					</div>
					{data.corrections
						.filter((item) => item.status === "pending")
						.map((item) => (
							<article className="journey-row" key={item.id}>
								<span className="journey-copy">
									<b>{item.personName}</b>
									<small>
										{item.note || "Says they did not join this journey."}
									</small>
								</span>
								<span className="button-row">
									<button
										type="button"
										onClick={() =>
											resolve.mutate({
												groupId: data.group.id,
												correctionId: item.id,
												status: "approved",
											})
										}
									>
										Approve
									</button>
									<button
										type="button"
										onClick={() =>
											resolve.mutate({
												groupId: data.group.id,
												correctionId: item.id,
												status: "rejected",
											})
										}
									>
										Reject
									</button>
								</span>
							</article>
						))}
				</section>
			)}
			<section>
				<div className="section-title">
					<div>
						<p className="eyebrow">Balances</p>
						<h3>Who owes what</h3>
					</div>
				</div>
				{data.people.length ? (
					<div className="balance-list">
						{data.people.map((p) => {
							const b = balances.get(p.id);
							const due = b?.balancePaise ?? 0;
							return (
								<div className="balance-row" key={p.id}>
									<span className="avatar">{p.name[0]?.toUpperCase()}</span>
									<span>
										<b>{p.name}</b>
										<small>
											{formatRupees(b?.paidPaise ?? 0)} paid of{" "}
											{formatRupees(b?.owedPaise ?? 0)}
										</small>
									</span>
									<strong className={due <= 0 ? "settled" : ""}>
										{due <= 0 ? "Settled" : formatRupees(due)}
									</strong>
								</div>
							);
						})}
					</div>
				) : (
					<p className="muted">Add contacts to split journey costs.</p>
				)}
			</section>
			<section>
				<div className="section-title">
					<div>
						<p className="eyebrow">History</p>
						<h3>Recent journeys</h3>
					</div>
					<button
						className="text-button"
						type="button"
						onClick={() => act("journey")}
					>
						Add journey <Plus size={15} />
					</button>
				</div>
				{data.journeys.length ? (
					<div className="journey-list">
						{data.journeys.map((j) => (
							<article key={j.id} className="journey-row">
								<span className="date-tile">
									<b>{j.journeyDate.slice(8)}</b>
									<small>
										{new Date(`${j.journeyDate}T00:00`).toLocaleDateString(
											"en-IN",
											{ month: "short" },
										)}
									</small>
								</span>
								<span className="journey-copy">
									<b>
										{j.direction === "two_way"
											? "Return journey"
											: "One-way journey"}
									</b>
									<small>
										{j.distanceKm} km ·{" "}
										{j.participants.map((p) => p.name).join(", ")}
									</small>
								</span>
								<span className="journey-cost">
									<b>{formatRupees(j.fuelCostPaise)}</b>
									<small>{formatRupees(j.sharePaise)} each</small>
								</span>
							</article>
						))}
					</div>
				) : (
					<Empty icon={<Fuel />} text="No journeys recorded yet." />
				)}
			</section>
		</>
	);
}

function Panel({
	kind,
	data,
	groupId,
	close,
	saved,
}: {
	kind: Action;
	data?: Detail;
	groupId?: string;
	close: () => void;
	saved: () => Promise<void>;
}) {
	const [form, setForm] = useState<Record<string, string>>({
		startDate: today(),
		journeyDate: today(),
		paidOn: today(),
		direction: "one_way",
		method: "upi",
		fuelType: "petrol",
	});
	const [people, setPeople] = useState<string[]>([]);
	const [price, setPrice] = useState<number>();
	const [fuelQuoteToken, setFuelQuoteToken] = useState<string>();
	const [source, setSource] = useState<"mypetrolprice" | "manual">(
		"mypetrolprice",
	);
	const [fuelStateChoice, setFuelStateChoice] = useState<{
		id: number;
		slug: string;
	}>();
	const set = (key: string, value: string) =>
		setForm((old) => ({ ...old, [key]: value }));
	const callbacks = {
		onSuccess: saved,
		onError: (e: { message: string }) => {
			toast.error(e.message);
		},
	};
	const newGroup = useMutation(trpc.groups.create.mutationOptions(callbacks));
	const newPerson = useMutation(trpc.people.add.mutationOptions(callbacks));
	const newJourney = useMutation(
		trpc.journeys.create.mutationOptions(callbacks),
	);
	const newPayment = useMutation(
		trpc.payments.create.mutationOptions(callbacks),
	);
	const updateSettings = useMutation(
		trpc.groups.updateSettings.mutationOptions(callbacks),
	);
	const fuelStates = useQuery({
		...trpc.fuel.states.queryOptions(),
		enabled: kind === "settings" || kind === "group",
		staleTime: 86_400_000,
	});
	const defaultFuelState = fuelStates.data?.find(
		(item) => item.name === data?.group.fuelState,
	);
	const activeFuelState = fuelStateChoice ?? defaultFuelState;
	const fuelDistricts = useQuery({
		...trpc.fuel.districts.queryOptions({
			stateId: activeFuelState?.id ?? 1,
			stateSlug: activeFuelState?.slug ?? "India",
		}),
		enabled:
			(kind === "settings" || kind === "group") && Boolean(activeFuelState),
		staleTime: 86_400_000,
	});
	const fuel = useQuery({
		...trpc.fuel.current.queryOptions({ groupId: groupId ?? "" }),
		enabled: false,
		retry: false,
	});
	const distance = Number(form.distanceKm || data?.group.normalOneWayKm || 0);
	const preview = useMemo(
		() =>
			price && people.length && data
				? calculateFuelCost({
						distanceKm: distance,
						mileageKmpl: Number(data.group.mileageKmpl),
						petrolPricePaise: price,
						participantCount: people.length,
					})
				: undefined,
		[data, distance, people.length, price],
	);
	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		if (kind === "group")
			newGroup.mutate({
				name: form.name ?? "",
				vehicleName: form.vehicle ?? "",
				mileageKmpl: Number(form.mileage),
				normalOneWayKm: Number(form.distance),
				startDate: form.startDate ?? today(),
				fuelType: form.fuelType as "petrol" | "diesel",
				fuelState: form.fuelState,
				fuelDistrict: form.fuelDistrict,
				fuelLocationId: Number(form.fuelLocationId),
			});
		if (kind === "person" && groupId)
			newPerson.mutate({
				groupId,
				name: form.name ?? "",
				email: form.email ?? "",
				phone: form.phone,
			});
		if (kind === "settings" && groupId && data)
			updateSettings.mutate({
				groupId,
				mileageKmpl: Number(form.mileage || data.group.mileageKmpl),
				normalOneWayKm: Number(form.distance || data.group.normalOneWayKm),
				fuelType: (form.fuelType || data.group.fuelType) as "petrol" | "diesel",
				fuelState: form.fuelState || data.group.fuelState,
				fuelDistrict: form.fuelDistrict || data.group.fuelDistrict,
				fuelLocationId: Number(
					form.fuelLocationId || data.group.fuelLocationId,
				),
			});
		if (kind === "payment" && groupId)
			newPayment.mutate({
				groupId,
				personId: form.personId ?? "",
				amountPaise: Math.round(Number(form.amount) * 100),
				method: form.method as "upi",
				paidOn: form.paidOn ?? today(),
				note: form.note,
			});
		if (kind === "journey" && groupId && price)
			newJourney.mutate({
				groupId,
				journeyDate: form.journeyDate ?? today(),
				direction: form.direction as "one_way" | "two_way",
				distanceKm: distance,
				participantIds: people,
				petrolPricePaise: price,
				petrolPriceSource: source,
				fuelQuoteToken,
			});
	};
	const getFuel = async () => {
		const result = await fuel.refetch();
		if (result.data) {
			setPrice(result.data.pricePaise);
			setFuelQuoteToken(result.data.quoteToken);
			setSource("mypetrolprice");
			toast.success(
				`${result.data.location} ${result.data.fuelType} price loaded`,
			);
		}
	};
	const busy =
		newGroup.isPending ||
		newPerson.isPending ||
		newJourney.isPending ||
		newPayment.isPending ||
		updateSettings.isPending;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop is a conventional modal dismissal target
		<div className="modal-backdrop" role="presentation" onMouseDown={close}>
			<div
				className="action-panel"
				role="dialog"
				aria-modal="true"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<div className="panel-head">
					<div>
						<p className="eyebrow">TripShare</p>
						<h2>
							{kind === "group"
								? "New carpool group"
								: kind === "person"
									? "Add a person"
									: kind === "payment"
										? "Record payment"
										: kind === "settings"
											? "Trip settings"
											: "Add journey"}
						</h2>
					</div>
					<button className="icon-button" type="button" onClick={close}>
						×
					</button>
				</div>
				<form className="panel-form" onSubmit={submit}>
					{kind === "group" && (
						<>
							<Field label="Group name">
								<input
									required
									onChange={(e) => set("name", e.target.value)}
									placeholder="Manipal office run"
								/>
							</Field>
							<Field label="Vehicle">
								<input
									required
									onChange={(e) => set("vehicle", e.target.value)}
									placeholder="Maruti Baleno"
								/>
							</Field>
							<div className="form-grid">
								<Field label="Mileage (km/l)">
									<input
										required
										type="number"
										min="1"
										step="0.1"
										onChange={(e) => set("mileage", e.target.value)}
									/>
								</Field>
								<Field label="One-way distance (km)">
									<input
										required
										type="number"
										min="0.1"
										step="0.1"
										onChange={(e) => set("distance", e.target.value)}
									/>
								</Field>
							</div>
							<Field label="Tracking start date">
								<input
									required
									type="date"
									value={form.startDate}
									onChange={(e) => set("startDate", e.target.value)}
								/>
							</Field>
							<p className="hint">
								The start date is private and prevents accidental backdating.
							</p>
							<Field label="Fuel type">
								<select
									value={form.fuelType}
									onChange={(e) => set("fuelType", e.target.value)}
								>
									<option value="petrol">Petrol</option>
									<option value="diesel">Diesel</option>
								</select>
							</Field>
							<div className="form-grid">
								<Field label="State">
									<select
										required
										value={form.fuelState ?? ""}
										onChange={(e) => {
											const option = fuelStates.data?.find(
												(item) => item.name === e.target.value,
											);
											set("fuelState", e.target.value);
											set("fuelDistrict", "");
											set("fuelLocationId", "");
											setFuelStateChoice(option);
										}}
									>
										<option value="" disabled>
											Select state
										</option>
										{fuelStates.data?.map((item) => (
											<option key={item.id} value={item.name}>
												{item.name}
											</option>
										))}
									</select>
								</Field>
								<Field label="District / city">
									<select
										required
										disabled={!activeFuelState}
										value={form.fuelDistrict ?? ""}
										onChange={(e) => {
											const option = fuelDistricts.data?.find(
												(item) => item.name === e.target.value,
											);
											set("fuelDistrict", e.target.value);
											if (option) set("fuelLocationId", String(option.id));
										}}
									>
										<option value="" disabled>
											Select district
										</option>
										{fuelDistricts.data?.map((item) => (
											<option key={item.id} value={item.name}>
												{item.name}
											</option>
										))}
									</select>
								</Field>
							</div>
						</>
					)}
					{kind === "person" && (
						<>
							<Field label="Name">
								<input required onChange={(e) => set("name", e.target.value)} />
							</Field>
							<Field label="Phone (optional)">
								<input
									type="tel"
									onChange={(e) => set("phone", e.target.value)}
								/>
							</Field>
							<Field label="Email">
								<input
									type="email"
									onChange={(e) => set("email", e.target.value)}
								/>
							</Field>
							<p className="hint">
								Optional. Adding a Google email later enables automatic
								read-only access.
							</p>
						</>
					)}
					{kind === "settings" && data && (
						<>
							<div className="form-grid">
								<Field label="Mileage (km/l)">
									<input
										type="number"
										min="1"
										step="0.1"
										defaultValue={data.group.mileageKmpl}
										onChange={(e) => set("mileage", e.target.value)}
									/>
								</Field>
								<Field label="One-way distance (km)">
									<input
										type="number"
										min="0.1"
										step="0.1"
										defaultValue={data.group.normalOneWayKm}
										onChange={(e) => set("distance", e.target.value)}
									/>
								</Field>
							</div>
							<Field label="Fuel type">
								<select
									defaultValue={data.group.fuelType}
									onChange={(e) => set("fuelType", e.target.value)}
								>
									<option value="petrol">Petrol</option>
									<option value="diesel">Diesel</option>
								</select>
							</Field>
							<div className="form-grid">
								<Field label="State">
									<select
										defaultValue={data.group.fuelState}
										onChange={(e) => {
											const option = fuelStates.data?.find(
												(item) => item.name === e.target.value,
											);
											set("fuelState", e.target.value);
											setFuelStateChoice(option);
										}}
									>
										<option value={data.group.fuelState}>
											{data.group.fuelState}
										</option>
										{fuelStates.data
											?.filter((item) => item.name !== data.group.fuelState)
											.map((item) => (
												<option key={item.id} value={item.name}>
													{item.name}
												</option>
											))}
									</select>
								</Field>
								<Field label="District / city">
									<select
										defaultValue={data.group.fuelDistrict}
										onChange={(e) => {
											const option = fuelDistricts.data?.find(
												(item) => item.name === e.target.value,
											);
											set("fuelDistrict", e.target.value);
											if (option) set("fuelLocationId", String(option.id));
										}}
									>
										<option value={data.group.fuelDistrict}>
											{data.group.fuelDistrict}
										</option>
										{fuelDistricts.data
											?.filter((item) => item.name !== data.group.fuelDistrict)
											.map((item) => (
												<option key={item.id} value={item.name}>
													{item.name}
												</option>
											))}
									</select>
								</Field>
							</div>
							<p className="hint">
								Locations are loaded directly from MyPetrolPrice. Existing
								settings remain usable if its directory is unavailable.
							</p>
						</>
					)}
					{kind === "payment" && (
						<>
							<Field label="Person">
								<select
									required
									defaultValue=""
									onChange={(e) => set("personId", e.target.value)}
								>
									<option value="" disabled>
										Select person
									</option>
									{data?.people.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
							</Field>
							<div className="form-grid">
								<Field label="Amount (₹)">
									<input
										required
										type="number"
										min="0.01"
										step="0.01"
										onChange={(e) => set("amount", e.target.value)}
									/>
								</Field>
								<Field label="Method">
									<select
										value={form.method}
										onChange={(e) => set("method", e.target.value)}
									>
										<option value="upi">UPI</option>
										<option value="cash">Cash</option>
										<option value="bank_transfer">Bank transfer</option>
										<option value="other">Other</option>
									</select>
								</Field>
							</div>
							<Field label="Paid on">
								<input
									type="date"
									value={form.paidOn}
									onChange={(e) => set("paidOn", e.target.value)}
								/>
							</Field>
							<Field label="Note">
								<input onChange={(e) => set("note", e.target.value)} />
							</Field>
						</>
					)}
					{kind === "journey" && (
						<>
							<div className="form-grid">
								<Field label="Date">
									<input
										type="date"
										min={data?.group.startDate}
										value={form.journeyDate}
										onChange={(e) => set("journeyDate", e.target.value)}
									/>
								</Field>
								<Field label="Direction">
									<select
										value={form.direction}
										onChange={(e) => {
											const v = e.target.value;
											set("direction", v);
											set(
												"distanceKm",
												String(
													Number(data?.group.normalOneWayKm) *
														(v === "two_way" ? 2 : 1),
												),
											);
										}}
									>
										<option value="one_way">One way</option>
										<option value="two_way">Two way</option>
									</select>
								</Field>
							</div>
							<Field label="Distance (km)">
								<input
									required
									type="number"
									min="0.1"
									step="0.1"
									value={form.distanceKm ?? data?.group.normalOneWayKm ?? ""}
									onChange={(e) => set("distanceKm", e.target.value)}
								/>
							</Field>
							<fieldset>
								<legend>Who joined?</legend>
								<div className="people-pills">
									{data?.people
										.filter((p) => p.isActive)
										.map((p) => (
											<button
												type="button"
												className={people.includes(p.id) ? "selected" : ""}
												key={p.id}
												onClick={() =>
													setPeople((old) =>
														old.includes(p.id)
															? old.filter((id) => id !== p.id)
															: [...old, p.id],
													)
												}
											>
												{people.includes(p.id) && <Check size={14} />}
												{p.name}
											</button>
										))}
								</div>
							</fieldset>
							<div className="fuel-box">
								<div>
									<Fuel size={20} />
									<span>
										<b>
											{data?.group.fuelDistrict} {data?.group.fuelType} price
										</b>
										<small>
											{price
												? `${formatRupees(price)} / litre`
												: "Required before saving"}
										</small>
									</span>
								</div>
								<button
									type="button"
									onClick={getFuel}
									disabled={fuel.isFetching}
								>
									{fuel.isFetching ? "Fetching…" : "Fetch live"}
								</button>
								{fuel.error && (
									<>
										<p className="error-text">{fuel.error.message}</p>
										<Field label="Manual price (₹/litre)">
											<input
												type="number"
												min="1"
												step="0.01"
												onChange={(e) => {
													setPrice(Math.round(Number(e.target.value) * 100));
													setFuelQuoteToken(undefined);
													setSource("manual");
												}}
											/>
										</Field>
									</>
								)}
							</div>
							{preview && (
								<div className="cost-preview">
									<span>
										<small>Total</small>
										<strong>{formatRupees(preview.fuelCostPaise)}</strong>
									</span>
									<span>
										<small>Per person</small>
										<strong>{formatRupees(preview.sharePaise)}</strong>
									</span>
								</div>
							)}
						</>
					)}
					<button
						className="primary-button submit-button"
						type="submit"
						disabled={
							busy || (kind === "journey" && (!price || !people.length))
						}
					>
						{busy ? "Saving…" : "Save"}
					</button>
				</form>
			</div>
		</div>
	);
}
