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
      <Button asChild size="sm">
        <Link to="/login">
          <LogIn />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 rounded-full px-1 pr-2.5">
          <Avatar className="size-7">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[130px] truncate text-sm font-medium sm:inline">{user?.name ?? "Account"}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user?.name ?? "Loading user..."}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.slice(0, 3).map((role: string) => (
                  <span key={role} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    {roleLabels[role] ?? role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to={authedPath}>
            <ShieldCheck />
            Open panel
          </Link>
        </DropdownMenuItem>

        {links.map((entry) => (
          <DropdownMenuItem key={entry.to} asChild>
            <Link to={entry.to}>
              <entry.icon />
              {entry.label}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound />
            Account information
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
