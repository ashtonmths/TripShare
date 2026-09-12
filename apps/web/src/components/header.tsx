"use client";
import { CarFront } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  return <header className="site-header"><Link className="brand" href="/"><span><CarFront size={19} /></span>TripShare</Link><nav><Link href="/dashboard">Dashboard</Link><ModeToggle /><UserMenu /></nav></header>;
}
