"use client";

import { useState, useEffect } from "react";
import type { Chat, User, Label } from "@/lib/types";
import {
  Home,
  MessageCircle,
  LineChart,
  Users,
  List,
  Bell,
  Settings,
  Search,
  Circle,
  Phone,
  Plus,
  UserPlus,
  UserCheck,
  AlertCircle,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { formatDate, cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { v4 as uuidv4 } from "uuid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as LabelComponent } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

interface SidebarProps {
  chats: Chat[];
  onChatSelect: (chat: Chat) => void;
  activeChat: Chat | null;
  currentUser: User | null;
  onChatCreated: () => void;
  unreadCounts?: Record<string, number>;
  totalUnread?: number;
}

export default function Sidebar({
  chats,
  onChatSelect,
  activeChat,
  currentUser,
  onChatCreated,
  unreadCounts = {},
  totalUnread = 0,
}: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // verify authentication on mount
  useEffect(() => {
    if (!isMounted) return;

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        console.error("No active session found");
      }
    };

    checkAuth();
  }, [isMounted, supabase]);

  // Fetch all labels for reference
  useEffect(() => {
    const fetchAllLabels = async () => {
      try {
        // Try to fetch from the new schema first
        const { data: newSchemaData, error: newSchemaError } = await supabase
          .from("labels")
          .select("*");

        if (!newSchemaError && newSchemaData && newSchemaData.length > 0) {
          // New schema data available
          setAllLabels(
            newSchemaData.map((label: any) => ({
              id: label.id,
              name: label.name,
              color: label.color,
            }))
          );
        } else {
          // Try the old schema as fallback
          const { data: oldSchemaData, error: oldSchemaError } = await supabase
            .from("chat_labels")
            .select("label")
            .distinct();

          if (!oldSchemaError && oldSchemaData) {
            // Convert old schema data to label format
            const uniqueLabels = [
              ...new Set(oldSchemaData.map((item: any) => item.label)),
            ];
            setAllLabels(
              uniqueLabels.map((label: string) => ({
                id: label,
                name: label,
                color: "bg-gray-100 text-gray-600 border-gray-200", // Default color
              }))
            );
          }
        }
      } catch (err) {
        console.error("Error fetching all labels:", err);
      }
    };

    if (isMounted) {
      fetchAllLabels();
    }
  }, [isMounted, supabase]);

  // filter chats based on search text and selected labels
  const filteredChats = chats.filter((chat) => {
    const matchesText =
      chat.name.toLowerCase().includes(filter.toLowerCase()) ||
      chat.participants.some((p) =>
        p.toLowerCase().includes(filter.toLowerCase())
      ) ||
      chat.labels.some((l) =>
        l.name.toLowerCase().includes(filter.toLowerCase())
      );

    const matchesLabels =
      selectedLabelIds.length === 0 ||
      chat.labels.some((label) => selectedLabelIds.includes(label.id));

    return matchesText && matchesLabels;
  });

  // search for users as the user types
  useEffect(() => {
    if (!newChatName.trim() || newChatName.length < 2) {
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }

    const searchUsers = async () => {
      setError(null);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .ilike("name", `%${newChatName}%`)
        .limit(5);

      if (userError) {
        console.error("Error searching users:", userError);
        setError("Failed to search for users");
        return;
      }

      // filter out current user from results
      const filteredUsers = userData.filter(
        (user) => user.id !== currentUser?.id
      );
      setSearchResults(filteredUsers);

      // Clear selected user if they're no longer in results
      if (
        selectedUser &&
        !filteredUsers.some((user) => user.id === selectedUser.id)
      ) {
        setSelectedUser(null);
      }
    };

    searchUsers();
  }, [newChatName, currentUser?.id, supabase, selectedUser]);

  const handleCreateChat = async () => {
    if (!currentUser) return;
    setError(null);

    if (!selectedUser) {
      setError("Please select a user to chat with");
      return;
    }

    setIsLoading(true);

    try {
      // Verify session before creating chat
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError(
          "Your session has expired. Please refresh the page and try again."
        );
        setIsLoading(false);
        return;
      }

      // Check if a chat already exists using a direct query instead of relying on policies
      const { data: existingChats, error: directQueryError } =
        await supabase.rpc("find_direct_chat", {
          user1_id: currentUser.id,
          user2_id: selectedUser.id,
        });

      if (directQueryError) {
        console.error("Error checking existing chats:", directQueryError);

        // Fallback approach if RPC fails
        try {
          // Create new chat directly
          const chatId = uuidv4();

          const { error: createChatError } = await supabase
            .from("chats")
            .insert({
              id: chatId,
              name: selectedUser.name,
              created_at: new Date().toISOString(),
              is_group: false,
              phone: selectedUser.phone || "",
            });

          if (createChatError) {
            console.error("Error creating chat:", createChatError);
            setError(`Failed to create chat: ${createChatError.message}`);
            setIsLoading(false);
            return;
          }

          // Add participants
          const participantsToAdd = [
            { chat_id: chatId, user_id: currentUser.id },
            { chat_id: chatId, user_id: selectedUser.id },
          ];

          const { error: participantsError } = await supabase
            .from("chat_participants")
            .insert(participantsToAdd);

          if (participantsError) {
            console.error("Error adding participants:", participantsError);
            setError(
              `Failed to add participants: ${participantsError.message}`
            );
            setIsLoading(false);
            return;
          }
        } catch (error: any) {
          console.error("Error in fallback chat creation:", error);
          setError("Failed to create chat. Please try again.");
          setIsLoading(false);
          return;
        }
      } else if (existingChats && existingChats.length > 0) {
        // Chat already exists, refresh and select it
        const existingChatId = existingChats[0];

        // Find the chat in the current list and select it
        const existingChat = chats.find((chat) => chat.id === existingChatId);
        if (existingChat) {
          onChatSelect(existingChat);
        }
      } else {
        // No existing chat found, create a new one using RPC
        const { data: newChatData, error: createChatError } =
          await supabase.rpc("create_direct_chat", {
            user1_id: currentUser.id,
            user2_id: selectedUser.id,
            chat_name: selectedUser.name,
            phone_number: selectedUser.phone || "",
          });

        if (createChatError) {
          console.error("Error creating chat via RPC:", createChatError);
          setError(`Failed to create chat: ${createChatError.message}`);
          setIsLoading(false);
          return;
        }
      }

      // Close dialog and refresh chats
      setNewChatName("");
      setSelectedUser(null);
      setSearchResults([]);
      setIsCreateChatOpen(false);
      onChatCreated();
    } catch (error: any) {
      console.error("Error in create chat process:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!currentUser || !newGroupName.trim() || selectedUsers.length === 0)
      return;
    setError(null);

    setIsLoading(true);

    try {
      // Verify session before creating group
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError(
          "Your session has expired. Please refresh the page and try again."
        );
        setIsLoading(false);
        return;
      }

      // Create group chat using RPC to avoid policy issues
      const { data: newGroupData, error: createGroupError } =
        await supabase.rpc("create_group_chat", {
          creator_id: currentUser.id,
          member_ids: selectedUsers,
          chat_name: newGroupName.trim(),
          created_timestamp: new Date().toISOString(),
        });

      if (createGroupError) {
        console.error("Error creating group chat via RPC:", createGroupError);

        // Fallback to direct creation if RPC fails
        try {
          // Create new group chat
          const chatId = uuidv4();

          const { error: chatError } = await supabase.from("chats").insert({
            id: chatId,
            name: newGroupName.trim(),
            created_at: new Date().toISOString(),
            is_group: true,
          });

          if (chatError) {
            console.error("Error creating group chat:", chatError);
            setError(`Failed to create group chat: ${chatError.message}`);
            setIsLoading(false);
            return;
          }

          // Add participants (including current user)
          const participantsToAdd = [
            { chat_id: chatId, user_id: currentUser.id },
            ...selectedUsers.map((userId) => ({
              chat_id: chatId,
              user_id: userId,
            })),
          ];

          const { error: participantsError } = await supabase
            .from("chat_participants")
            .insert(participantsToAdd);

          if (participantsError) {
            console.error(
              "Error adding group participants:",
              participantsError
            );
            setError(
              `Failed to add group participants: ${participantsError.message}`
            );
            setIsLoading(false);
            return;
          }
        } catch (error: any) {
          console.error("Error in fallback group creation:", error);
          setError("Failed to create group chat. Please try again.");
          setIsLoading(false);
          return;
        }
      }

      // Close dialog and refresh chats
      setNewGroupName("");
      setSelectedUsers([]);
      setIsCreateGroupOpen(false);
      onChatCreated();
    } catch (error: any) {
      console.error("Error in create group process:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateGroupDialog = async () => {
    if (!isMounted) return;
    setError(null);

    // available users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .neq("id", currentUser?.id || "");

    if (userError) {
      console.error("Error fetching users:", userError);
      setError("Failed to fetch users");
      return;
    }

    setAvailableUsers(userData);
    setIsCreateGroupOpen(true);
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error logging out:", error);
        return;
      }

      // Close the dialog and redirect to auth page
      setIsLogoutDialogOpen(false);
      router.push("/auth");
    } catch (err) {
      console.error("Unexpected error during logout:", err);
    }
  };

  const handleFilterChange = (labelIds: string[]) => {
    console.log("Filtering by label IDs:", labelIds);
    setSelectedLabelIds(labelIds);
  };

  // Get the most up-to-date label information
  const getUpdatedLabel = (label: Label): Label => {
    const updatedLabel = allLabels.find((l) => l.id === label.id);
    if (updatedLabel) {
      return updatedLabel;
    }
    return label;
  };

  return (
    <div className="flex h-full">
      {/* Left navigation bar */}
      <div className="w-14 bg-white border-r flex flex-col items-center py-4 space-y-6">
        <div className="w-8 h-8 rounded-md bg-green-600 flex items-center justify-center">
          <MessageCircle size={18} className="text-white" />
        </div>
        <div className="flex flex-col space-y-6 items-center">
          <Home size={20} className="text-gray-500" />
          <div className="relative">
            <MessageCircle size={20} className="text-green-600" />
            {totalUnread > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">{totalUnread}</span>
              </div>
            )}
          </div>
          <LineChart size={20} className="text-gray-500" />
          <List size={20} className="text-gray-500" />
          <Users size={20} className="text-gray-500" />
          <Bell size={20} className="text-gray-500" />
          <Settings size={20} className="text-gray-500" />
        </div>

        {/* Logout button at the bottom */}
        <div className="mt-auto mb-4">
          <button
            onClick={() => setIsLogoutDialogOpen(true)}
            className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-gray-100"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="w-80 border-r overflow-hidden flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle size={16} className="text-gray-500" />
            <span className="text-gray-500 text-sm font-medium">chats</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              className="text-gray-500 hover:text-green-600"
              onClick={() => setIsCreateChatOpen(true)}
            >
              <Plus size={16} />
            </button>
            <button
              className="text-gray-500 hover:text-green-600"
              onClick={openCreateGroupDialog}
            >
              <UserPlus size={16} />
            </button>
            <button className="text-gray-500">
              <Bell size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 border-b">
          <div className="flex items-center space-x-2 mb-2">
            <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 rounded-md">
              <Circle size={14} className="text-green-600" />
              <span className="text-green-600 text-xs">Custom filter</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-2 top-2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-8 pr-2 py-1 text-sm border rounded-md"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => {
            const unreadCount = unreadCounts[chat.id] || 0;

            return (
              <div
                key={chat.id}
                className={cn(
                  "p-3 border-b hover:bg-gray-50 cursor-pointer",
                  activeChat?.id === chat.id ? "bg-gray-50" : "",
                  unreadCount > 0 ? "bg-green-50" : ""
                )}
                onClick={() => onChatSelect(chat)}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    {chat.avatar ? (
                      <Image
                        src={
                          chat.avatar || "/placeholder.svg?height=40&width=40"
                        }
                        alt={chat.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500">
                          {chat.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    {chat.status === "online" && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3
                        className={cn(
                          "text-sm font-medium truncate",
                          unreadCount > 0 ? "font-bold" : ""
                        )}
                      >
                        {chat.name}
                      </h3>
                      <div className="flex items-center space-x-1">
                        {unreadCount > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-xs text-gray-500 truncate mt-1",
                        unreadCount > 0 ? "font-semibold" : ""
                      )}
                    >
                      {chat.lastMessage}
                    </p>

                    {/* Labels */}
                    {chat.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chat.labels.map((label) => {
                          // Get the most up-to-date label information
                          const updatedLabel = getUpdatedLabel(label);
                          return (
                            <span
                              key={updatedLabel.id}
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                updatedLabel.color
                              )}
                            >
                              {updatedLabel.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center space-x-1 mt-1">
                      <Phone size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {chat.phone}
                      </span>
                      {chat.extension && (
                        <span className="text-xs text-gray-400">
                          +{chat.extension}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 text-right mt-1">
                  {formatDate(chat.lastMessageTime)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Chat Dialog */}
      {isMounted && (
        <>
          <Dialog open={isCreateChatOpen} onOpenChange={setIsCreateChatOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Chat</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <LabelComponent htmlFor="name" className="text-right">
                    Find User
                  </LabelComponent>
                  <div className="col-span-3">
                    <Input
                      id="name"
                      placeholder="Search by name"
                      className="mb-2"
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                    />

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="border rounded-md max-h-[200px] overflow-y-auto">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            className={cn(
                              "flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50",
                              selectedUser?.id === user.id ? "bg-green-50" : ""
                            )}
                            onClick={() => setSelectedUser(user)}
                          >
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                                <span className="text-gray-500 text-xs">
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {user.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            {selectedUser?.id === user.id && (
                              <UserCheck size={16} className="text-green-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No results message */}
                    {newChatName.trim().length >= 2 &&
                      searchResults.length === 0 && (
                        <p className="text-sm text-gray-500 p-2">
                          No users found. Try a different search term.
                        </p>
                      )}

                    {/* Selected user display */}
                    {selectedUser && (
                      <div className="mt-2 p-2 border rounded-md bg-green-50">
                        <p className="text-sm font-medium">
                          Selected: {selectedUser.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Display error message if any */}
                {error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateChatOpen(false);
                    setSelectedUser(null);
                    setNewChatName("");
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateChat}
                  disabled={!selectedUser || isLoading}
                >
                  {isLoading ? "Creating..." : "Create Chat"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Group Dialog */}
          <Dialog
            open={isCreateGroupOpen}
            onOpenChange={(open) => {
              setIsCreateGroupOpen(open);
              if (!open) setError(null);
            }}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <LabelComponent htmlFor="group-name" className="text-right">
                    Group Name
                  </LabelComponent>
                  <Input
                    id="group-name"
                    placeholder="Enter group name"
                    className="col-span-3"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <LabelComponent className="text-right pt-2">
                    Members
                  </LabelComponent>
                  <div className="col-span-3 border rounded-md p-2 max-h-[200px] overflow-y-auto">
                    {availableUsers.length > 0 ? (
                      availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-2 py-1"
                        >
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                          />
                          <LabelComponent
                            htmlFor={`user-${user.id}`}
                            className="cursor-pointer"
                          >
                            {user.name}
                          </LabelComponent>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        No users available
                      </p>
                    )}
                  </div>
                </div>

                {/* Display error message if any */}
                {error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateGroupOpen(false);
                    setSelectedUsers([]);
                    setNewGroupName("");
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  disabled={
                    !newGroupName.trim() ||
                    selectedUsers.length === 0 ||
                    isLoading
                  }
                >
                  {isLoading ? "Creating..." : "Create Group"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Logout Confirmation Dialog */}
          <Dialog
            open={isLogoutDialogOpen}
            onOpenChange={setIsLogoutDialogOpen}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Logout</DialogTitle>
                <DialogDescription>
                  Are you sure you want to logout? You will need to sign in
                  again to access your chats.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsLogoutDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleLogout}>
                  Logout
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
