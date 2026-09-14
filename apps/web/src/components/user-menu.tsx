import { Button } from "@TripShare/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@TripShare/ui/components/dropdown-menu";
import { Skeleton } from "@TripShare/ui/components/skeleton";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link href="/login">
				<Button variant="outline">Sign In</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className="user-trigger" variant="outline" />}
			>
				<span className="user-avatar">
					{session.user.image ? (
						<Image
							src={session.user.image}
							alt=""
							width={24}
							height={24}
							unoptimized
						/>
					) : (
						session.user.name.slice(0, 1).toUpperCase()
					)}
				</span>
				<span className="user-name">{session.user.name}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
					<DropdownMenuItem
						onClick={async () => {
							const name = window.prompt("Display name", session.user.name);
							if (!name || name.trim().length < 2 || name === session.user.name)
								return;
							const result = await authClient.updateUser({ name: name.trim() });
							if (result.error)
								toast.error(result.error.message ?? "Profile update failed");
							else {
								toast.success("Profile updated");
								router.refresh();
							}
						}}
					>
						Edit display name
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										router.push("/");
									},
								},
							});
						}}
					>
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
