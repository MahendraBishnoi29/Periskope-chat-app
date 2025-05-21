/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User as UserType } from "@/lib/types";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Settings, User, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface UserMenuProps {
  user: UserType | null;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error logging out:", error);
        return;
      }

      router.push("/auth");
    } catch (err) {
      console.error("Unexpected error during logout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-gray-200 transition-colors">
          {user?.avatar ? (
            <img
              src={user.avatar || "/placeholder.svg"}
              alt={user.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <UserCircle className="w-6 h-6 text-gray-500" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{user?.name}</span>
            <span className="text-xs text-gray-500">{user?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
