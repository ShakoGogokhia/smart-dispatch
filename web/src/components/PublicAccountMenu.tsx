import { BarChart3, BriefcaseBusiness, ChevronDown, ClipboardList, LogIn, LogOut, MapPinned, ShieldCheck, Store, UserRound, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { resolveApiMediaUrl } from "@/lib/media";
import { getDefaultAuthedPath } from "@/lib/session";
import { useMe } from "@/lib/useMe";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  owner: "Market owner",
  staff: "Staff",
  driver: "Driver",
  customer: "Customer",
};

function initials(name?: string | null) {
  return (name ?? "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export default function PublicAccountMenu() {
  const token = auth.getToken();
  const meQ = useMe({ enabled: !!token });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = meQ.data;
  const roles = user?.roles ?? [];
  const authedPath = getDefaultAuthedPath(roles);
  const profilePhotoUrl = resolveApiMediaUrl(user?.profile_photo_url);

  const links = [
    { label: "Orders", to: "/orders", icon: ClipboardList, show: !!user },
    { label: "Driver hub", to: "/driver-hub", icon: MapPinned, show: roles.includes("driver") },
    { label: "My markets", to: "/my-markets", icon: BriefcaseBusiness, show: roles.includes("owner") || roles.includes("staff") || roles.includes("admin") },
    { label: "Markets", to: "/markets", icon: Store, show: roles.includes("admin") },
    { label: "Users", to: "/users", icon: Users, show: roles.includes("admin") },
    { label: "Analytics", to: "/analytics", icon: BarChart3, show: roles.includes("admin") },
  ].filter((entry) => entry.show);

  const logout = async () => {
    try {
      await api.post("/api/logout");
    } catch {
      // Local logout should still happen if the token is already invalid.
    }

    auth.clear();
    queryClient.clear();
    navigate("/");
  };

  if (!token) {
    return (
      <Button asChild variant="outline" className="h-11 rounded-full border-zinc-300 bg-white/90 px-4 dark:border-zinc-700 dark:bg-zinc-900/90">
        <Link to="/login">
          <LogIn className="mr-2 h-4 w-4" />
          Login
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-12 rounded-full border-zinc-300 bg-white/90 px-2 pr-4 dark:border-zinc-700 dark:bg-zinc-900/90">
          <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-700">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
            <AvatarFallback className="bg-cyan-600 text-sm font-semibold text-white">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[130px] truncate text-sm font-medium sm:inline">{user?.name ?? "Account"}</span>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-zinc-200 p-2 shadow-2xl dark:border-zinc-800">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-zinc-200 dark:border-zinc-700">
              {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
              <AvatarFallback className="bg-cyan-600 text-base font-semibold text-white">{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{user?.name ?? "Loading user..."}</div>
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user?.email ?? ""}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.slice(0, 3).map((role: string) => (
                  <span key={role} className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200">
                    {roleLabels[role] ?? role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5">
          <Link to={authedPath}>
            <ShieldCheck className="h-4 w-4" />
            Open panel
          </Link>
        </DropdownMenuItem>

        {links.map((entry) => (
          <DropdownMenuItem key={entry.to} asChild className="rounded-xl px-3 py-2.5">
            <Link to={entry.to}>
              <entry.icon className="h-4 w-4" />
              {entry.label}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5">
          <Link to="/profile">
            <UserRound className="h-4 w-4" />
            Account information
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-rose-600 focus:text-rose-600 dark:text-rose-300 dark:focus:text-rose-300" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
