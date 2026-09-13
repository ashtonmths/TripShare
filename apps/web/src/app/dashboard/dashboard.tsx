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
	const [selected, setSelected] = useState<string>();
	const [panel, setPanel] = useState<Action>();
	const groupId = selected ?? groups.data?.[0]?.id;
	const detail = useQuery({
		...trpc.groups.detail.queryOptions({ groupId: groupId ?? "" }),
		enabled: Boolean(groupId),
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
							<p className="eyebrow">Groups</p>
							<h2>Your carpools</h2>
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
					{!groups.data?.length ? (
						<Empty icon={<Car />} text="Create your first group to begin." />
					) : (
						groups.data.map((item) => (
							<button
								type="button"
								key={item.id}
								className={`group-row ${groupId === item.id ? "active" : ""}`}
								onClick={() => setSelected(item.id)}
							>
								<span className="group-icon">
									<Car size={18} />
								</span>
								<span>
									<b>{item.name}</b>
									<small>
										{item.vehicleName} · {item.mileageKmpl} km/l
									</small>
								</span>
							</button>
						))
					)}
				</aside>
				<section className="ledger-pane">
					{!groupId ? (
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
type Action = "group" | "person" | "journey" | "payment";
const Empty = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
	<div className="empty-small">
		{icon}
		<p>{text}</p>
	</div>
);

function Ledger({ data, act }: { data: Detail; act: (a: Action) => void }) {
	const balances = new Map(data.balances.map((b) => [b.personId, b]));
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
	});
	const [people, setPeople] = useState<string[]>([]);
	const [price, setPrice] = useState<number>();
	const [fuelQuoteToken, setFuelQuoteToken] = useState<string>();
	const [source, setSource] = useState<"indianapi" | "manual">("indianapi");
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
	const fuel = useQuery({
		...trpc.fuel.current.queryOptions(),
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
			});
		if (kind === "person" && groupId)
			newPerson.mutate({ groupId, name: form.name ?? "", phone: form.phone });
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
			setSource("indianapi");
			toast.success("Udupi petrol price loaded");
		}
	};
	const busy =
		newGroup.isPending ||
		newPerson.isPending ||
		newJourney.isPending ||
		newPayment.isPending;
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
							<p className="hint">
								Contacts don’t receive invitations and never need an account.
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
										<b>Petrol price · Udupi</b>
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
