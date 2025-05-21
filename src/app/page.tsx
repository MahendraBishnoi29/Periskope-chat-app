/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/sidebar";
import ChatWindow from "@/components/chat-window";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import type { Chat, User, Message, Label, ChatParticipant } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function Home() {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLastReadAvailable, setIsLastReadAvailable] = useState(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const activeChatRef = useRef<string | null>(null);

  const router = useRouter();
  const supabase = createClientComponentClient();

  // Set isMounted to true when component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check authentication status
  useEffect(() => {
    if (!isMounted) return;

    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth");
        return;
      }

      // Get current user details
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user data:", userError);
        return;
      }

      setUser(userData);

      // Fetch chats and users
      await fetchChats();
      await fetchUsers();

      setLoading(false);
    };

    checkUser();
  }, [isMounted, router, supabase]);

  // Update activeChatRef when activeChat changes
  useEffect(() => {
    if (activeChat) {
      activeChatRef.current = activeChat.id;

      // Mark chat as read when selected
      if (activeChat.unreadCount && activeChat.unreadCount > 0) {
        markChatAsRead(activeChat.id);
      }
    } else {
      activeChatRef.current = null;
    }
  }, [activeChat]);

  // Fetch chats
  const fetchChats = async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Get all chats where the current user is a participant
      let query = supabase
        .from("chat_participants")
        .select("chat_id")
        .eq("user_id", session.user.id);

      // Only select last_read if we know it's available
      if (isLastReadAvailable) {
        //@ts-expect-error last_read column may not exist in older schema versions
        query = query.select("chat_id, last_read");
      }

      const { data: chatParticipants, error: participantsError } = await query;

      if (participantsError) {
        // Check if the error is about the missing last_read column
        if (
          participantsError.message &&
          participantsError.message.includes("last_read")
        ) {
          console.warn("last_read column not available, continuing without it");
          setIsLastReadAvailable(false);
          // Retry without requesting the last_read column
          return fetchChats();
        }

        console.error("Error fetching chat participants:", participantsError);
        setError(`Error loading chats: ${participantsError.message}`);
        return;
      }

      if (!chatParticipants || chatParticipants.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      //@ts-expect-error ids maybe null
      const chatIds = chatParticipants.map((cp: ChatParticipant) => cp.chat_id);

      // Get chat details
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .in("id", chatIds);

      if (chatError || !chatData) {
        console.error("Error fetching chats:", chatError);
        setError(`Error loading chat details: ${chatError?.message}`);
        return;
      }

      // Get last message for each chat
      const chatsWithMessages = await Promise.all(
        chatData.map(async (chat) => {
          // Get last message
          const { data: lastMessageData, error: lastMessageError } =
            await supabase
              .from("messages")
              .select("*")
              .eq("chat_id", chat.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

          // Get participants
          const { data: participants, error: participantsError } =
            await supabase
              .from("chat_participants")
              .select("users(name)")
              .eq("chat_id", chat.id);

          // Get all messages for this chat
          const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("*, users!inner(*)")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: true });

          // Get labels for this chat - handle the case where labels table might not exist yet
          let labels: Label[] = [];
          try {
            // First try to get labels using the new schema (with label_id)
            const { data: chatLabelsData, error: chatLabelsError } =
              await supabase
                .from("chat_labels")
                .select("label_id, labels(id, name, color)")
                .eq("chat_id", chat.id);

            if (
              !chatLabelsError &&
              chatLabelsData &&
              chatLabelsData.length > 0
            ) {
              // If we have data with the new schema
              labels = chatLabelsData
                .filter((cl: any) => cl.labels) // Filter out any null labels
                .map((cl: any) => ({
                  id: cl.labels.id,
                  name: cl.labels.name,
                  color: cl.labels.color,
                }));
            } else {
              // Try the old schema with direct label column
              const { data: oldLabelsData, error: oldLabelsError } =
                await supabase
                  .from("chat_labels")
                  .select("label")
                  .eq("chat_id", chat.id);

              if (!oldLabelsError && oldLabelsData) {
                // For old schema, we'll use a default color since we don't have color info
                labels = oldLabelsData.map((cl: any) => ({
                  id: cl.label, // Use label as ID
                  name: cl.label,
                  color: "bg-gray-100 text-gray-600 border-gray-200", // Default color
                }));
              }
            }
          } catch (error) {
            console.warn("Labels functionality not available yet:", error);
            // Continue without labels if there's an error
          }

          if (lastMessageError && lastMessageError.code !== "PGRST116") {
            console.error("Error fetching last message:", lastMessageError);
          }

          if (participantsError) {
            console.error("Error fetching participants:", participantsError);
          }

          if (messagesError) {
            console.error("Error fetching messages:", messagesError);
          }

          const formattedMessages: Message[] = messages
            ? messages.map((msg: any) => ({
                id: msg.id,
                sender: msg.users.name,
                content: msg.content,
                timestamp: msg.created_at,
                email: msg.users.email,
                attachments: msg.attachments || [],
              }))
            : [];

          // Count unread messages - handle case where last_read is not available
          let unreadCount = 0;
          if (isLastReadAvailable) {
            // Get the last read timestamp for this chat
            const chatParticipant = chatParticipants.find(
              (cp: { chat_id: any; user_id?: any }) => cp.chat_id === chat.id
            );
            //@ts-expect-error need to fix type for this
            const lastRead = chatParticipant?.last_read || null;

            if (lastRead) {
              unreadCount = messages
                ? messages.filter(
                    (msg: any) =>
                      msg.user_id !== session.user.id &&
                      new Date(msg.created_at) > new Date(lastRead)
                  ).length
                : 0;
            } else {
              // If no last_read timestamp, count all messages not from current user
              unreadCount = messages
                ? messages.filter((msg: any) => msg.user_id !== session.user.id)
                    .length
                : 0;
            }
          } else {
            // If last_read is not available, just count all messages not from the current user
            unreadCount = messages
              ? messages.filter((msg: any) => msg.user_id !== session.user.id)
                  .length
              : 0;
          }

          // If this is the active chat, mark it as read
          if (activeChatRef.current === chat.id) {
            unreadCount = 0;
          }

          // Update unread counts
          setUnreadCounts((prev) => ({
            ...prev,
            [chat.id]: unreadCount,
          }));

          return {
            id: chat.id,
            name: chat.name,
            avatar: chat.avatar,
            participants: participants
              ? participants.map((p: any) => p.users.name)
              : [],
            lastMessage: lastMessageData
              ? lastMessageData.content
              : "No messages yet",
            lastMessageTime: lastMessageData
              ? lastMessageData.created_at
              : chat.created_at,
            messages: formattedMessages,
            status: chat.is_group
              ? undefined
              : ("online" as "online" | "offline" | undefined),
            labels: labels,
            phone: chat.phone || "",
            extension: chat.extension,
            is_group: chat.is_group,
            unreadCount,
          };
        })
      );

      setChats(chatsWithMessages);

      // Set active chat if none is selected
      if (!activeChat && chatsWithMessages.length > 0) {
        setActiveChat(chatsWithMessages[0]);
      } else if (activeChat) {
        // Update active chat with new data
        const updatedActiveChat = chatsWithMessages.find(
          (c) => c.id === activeChat.id
        );
        if (updatedActiveChat) {
          setActiveChat(updatedActiveChat);
        }
      }
    } catch (error: any) {
      console.error("Error in fetchChats:", error);
      setError(`Error loading chats: ${error.message}`);
    }
  }; // Fetch users
  const fetchUsers = async () => {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*");

    if (userError) {
      console.error("Error fetching users:", userError);
      return;
    }

    const formattedUsers: User[] = userData.map((user: User) => ({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      email: user.email,
      status: user.status || "offline",
    }));

    setUsers(formattedUsers);
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isMounted || !user) return;

    let messagesSubscription: RealtimeChannel | null = null;
    let chatsSubscription: RealtimeChannel | null = null;
    let labelsSubscription: RealtimeChannel | null = null;

    // Only set up subscriptions on the client side
    const setupSubscriptions = async () => {
      // Subscribe to new messages
      messagesSubscription = supabase
        .channel("messages-channel")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            // Check if message belongs to one of our chats
            const message = payload.new;

            // Skip if this is a message we just sent (to avoid duplicates)
            if (lastMessageIdRef.current === message.id) {
              return;
            }

            const chatIndex = chats.findIndex((c) => c.id === message.chat_id);

            if (chatIndex >= 0) {
              // Check if this message already exists in the chat (to prevent duplicates)
              const messageExists = chats[chatIndex].messages.some(
                (msg) => msg.id === message.id
              );
              if (messageExists) {
                return;
              }

              // Get user details for the message
              const { data: userData, error: userError } = await supabase
                .from("users")
                .select("*")
                .eq("id", message.user_id)
                .single();

              if (userError) {
                console.error("Error fetching message user:", userError);
                return;
              }

              // Update the chat with the new message
              const updatedChats = [...chats];
              const newMessage: Message = {
                id: message.id,
                sender: userData.name,
                content: message.content,
                timestamp: message.created_at,
                email: userData.email,
                attachments: message.attachments || [],
              };

              updatedChats[chatIndex].messages.push(newMessage);
              updatedChats[chatIndex].lastMessage = message.content;
              updatedChats[chatIndex].lastMessageTime = message.created_at;

              // Update unread count if this is not the active chat or not from current user
              if (message.user_id !== user.id) {
                // Only increment unread count if this is not the active chat
                if (activeChatRef.current !== message.chat_id) {
                  updatedChats[chatIndex].unreadCount =
                    (updatedChats[chatIndex].unreadCount || 0) + 1;

                  setUnreadCounts((prev) => ({
                    ...prev,
                    [message.chat_id]: (prev[message.chat_id] || 0) + 1,
                  }));
                } else {
                  // If this is the active chat, mark it as read immediately
                  markChatAsRead(message.chat_id);
                }
              }

              setChats(updatedChats);

              // If this is the active chat, update it too
              if (activeChat && activeChat.id === message.chat_id) {
                // Check if the message already exists in the active chat
                const messageExistsInActive = activeChat.messages.some(
                  (msg) => msg.id === message.id
                );
                if (!messageExistsInActive) {
                  setActiveChat({
                    ...activeChat,
                    messages: [...activeChat.messages, newMessage],
                    lastMessage: message.content,
                    lastMessageTime: message.created_at,
                    // Don't increment unread count for active chat
                    unreadCount:
                      message.user_id !== user.id ? 0 : activeChat.unreadCount,
                  });

                  // Mark as read if this is the active chat and not from current user
                  if (message.user_id !== user.id) {
                    markChatAsRead(message.chat_id);
                  }
                }
              }
            }
          }
        )
        .subscribe();

      // Subscribe to new chats
      chatsSubscription = supabase
        .channel("chats-channel")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_participants",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refresh chats when a new chat is created
            fetchChats();
          }
        )
        .subscribe();

      // Try to subscribe to label changes if the tables exist
      try {
        labelsSubscription = supabase
          .channel("labels-channel")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "chat_labels",
            },
            () => {
              // Refresh chats when labels change
              fetchChats();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "labels",
            },
            () => {
              // Refresh chats when labels change
              fetchChats();
            }
          )
          .subscribe();
      } catch (error) {
        console.warn("Labels subscription not available yet:", error);
      }
    };

    setupSubscriptions();

    return () => {
      if (messagesSubscription) supabase.removeChannel(messagesSubscription);
      if (chatsSubscription) supabase.removeChannel(chatsSubscription);
      if (labelsSubscription) supabase.removeChannel(labelsSubscription);
    };
  }, [isMounted, user, chats, activeChat, supabase]);
  const handleChatSelect = (chat: Chat) => {
    setActiveChat(chat);

    // Mark chat as read when selected
    if (chat.unreadCount && chat.unreadCount > 0) {
      markChatAsRead(chat.id);
    }
  };

  const markChatAsRead = async (chatId: string) => {
    if (!user || !isLastReadAvailable) return;

    try {
      // Update the last_read timestamp for this chat participant
      const { error } = await supabase
        .from("chat_participants")
        .update({ last_read: new Date().toISOString() })
        .eq("chat_id", chatId)
        .eq("user_id", user.id);

      if (error) {
        // If the error is about the missing last_read column, update our state
        if (error.message && error.message.includes("last_read")) {
          setIsLastReadAvailable(false);
          console.warn("last_read column not available, skipping update");
          return;
        }

        console.error("Error marking chat as read:", error);
        return;
      }

      // Update local state
      setUnreadCounts((prev) => ({
        ...prev,
        [chatId]: 0,
      }));

      // Update the unread count in the chats array
      setChats((prevChats) =>
        prevChats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (error) {
      console.error("Error in markChatAsRead:", error);
    }
  };

  const handleMessageSent = async (messageId: string) => {
    // Store the ID of the message we just sent to avoid duplicates
    lastMessageIdRef.current = messageId;

    // Clear the ID after a short delay
    setTimeout(() => {
      if (lastMessageIdRef.current === messageId) {
        lastMessageIdRef.current = null;
      }
    }, 5000);

    // Refresh chats
    await fetchChats();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Calculate total unread messages
  const totalUnread = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="flex h-screen bg-white">
      {error && (
        <Alert
          variant="destructive"
          className="absolute top-4 right-4 w-auto z-50"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLastReadAvailable && (
        <Alert className="absolute top-4 left-1/2 transform -translate-x-1/2 w-auto z-50 bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-700">
            Database schema update required. Please run the SQL script to add
            the last_read column.
          </AlertDescription>
        </Alert>
      )}

      <Sidebar
        chats={chats}
        onChatSelect={handleChatSelect}
        activeChat={activeChat}
        currentUser={user}
        onChatCreated={fetchChats}
        unreadCounts={unreadCounts}
        totalUnread={totalUnread}
      />
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          users={users}
          currentUser={user}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Select a chat to start messaging</p>
        </div>
      )}
    </div>
  );
}
