"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import type { Chat, User, Attachment } from "@/lib/types"
import {
  RefreshCw,
  HelpCircle,
  Star,
  Maximize2,
  Bell,
  Menu,
  Paperclip,
  Smile,
  Clock,
  ImageIcon,
  Mic,
  Send,
  X,
  File,
  Video,
  AlertCircle,
} from "lucide-react"
import Image from "next/image"
import { formatTime, formatMessageDate, cn } from "@/lib/utils"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { v4 as uuidv4 } from "uuid"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ChatWindowProps {
  chat: Chat
  users: User[]
  currentUser: User | null
  onMessageSent: (messageId: string) => void
}

export default function ChatWindow({ chat, users, currentUser, onMessageSent }: ChatWindowProps) {
  const [message, setMessage] = useState("")
  const [activeTab, setActiveTab] = useState("WhatsApp")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()

  // Set isMounted to true when component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isMounted) {
      scrollToBottom()
    }
  }, [chat.messages, isMounted])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Modify the handleSendMessage function to ensure we're handling message IDs properly

  const handleSendMessage = async () => {
    if (!currentUser || (!message.trim() && attachments.length === 0)) return

    setIsUploading(true)
    setError(null)

    try {
      // Generate a unique message ID
      const messageId = uuidv4()

      // Upload attachments if any
      const uploadedAttachments: Attachment[] = []

      if (attachments.length > 0) {
        // Create the bucket if it doesn't exist (this is a workaround)
        try {
          await supabase.storage.createBucket("chat-attachments", {
            public: true,
            fileSizeLimit: 50 * 1024 * 1024, // 50MB
          })
        } catch (error) {
          // Bucket might already exist, which is fine
          console.log("Bucket creation attempt:", error)
        }

        for (const file of attachments) {
          try {
            const fileExt = file.name.split(".").pop()
            const fileName = `${uuidv4()}.${fileExt}`
            const filePath = `${currentUser.id}/${fileName}`

            // Upload file to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("chat-attachments")
              .upload(filePath, file, {
                cacheControl: "3600",
                upsert: true, // Use upsert to overwrite if file exists
              })

            if (uploadError) {
              console.error("Error uploading file:", uploadError)
              throw new Error(`Failed to upload file: ${uploadError.message}`)
            }

            // Get public URL
            const {
              data: { publicUrl },
            } = supabase.storage.from("chat-attachments").getPublicUrl(filePath)

            uploadedAttachments.push({
              id: uuidv4(),
              name: file.name,
              url: publicUrl,
              type: file.type,
              size: file.size,
            })
          } catch (fileError) {
            console.error("Error processing file:", fileError)
            setError(`Error uploading file: ${file.name}. Please try again.`)
          }
        }
      }

      // Insert message into database
      const { error: messageError } = await supabase.from("messages").insert({
        id: messageId,
        chat_id: chat.id,
        user_id: currentUser.id,
        content: message.trim(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        created_at: new Date().toISOString(),
      })

      if (messageError) {
        console.error("Error sending message:", messageError)
        setError(`Error sending message: ${messageError.message}`)
        return
      }

      // Clear input and attachments
      setMessage("")
      setAttachments([])

      // Notify parent component about the sent message
      onMessageSent(messageId)
    } catch (error: any) {
      console.error("Error in send message process:", error)
      setError(`Error sending message: ${error.message || "Unknown error"}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files))
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const renderAttachmentPreview = (file: File, index: number) => {
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")

    return (
      <div key={index} className="relative inline-block mr-2 mb-2">
        <div className="border rounded-md p-1 bg-gray-50">
          {isImage ? (
            <div className="w-20 h-20 relative">
              <Image
                src={URL.createObjectURL(file) || "/placeholder.svg"}
                alt={file.name}
                fill
                className="object-cover rounded"
              />
            </div>
          ) : isVideo ? (
            <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded">
              <Video size={24} className="text-gray-500" />
            </div>
          ) : (
            <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded">
              <File size={24} className="text-gray-500" />
            </div>
          )}
          <button
            onClick={() => removeAttachment(index)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  const renderAttachment = (attachment: Attachment) => {
    const isImage = attachment.type.startsWith("image/")
    const isVideo = attachment.type.startsWith("video/")

    if (isImage) {
      return (
        <div className="mt-2">
          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
            <Image
              src={attachment.url || "/placeholder.svg"}
              alt={attachment.name}
              width={200}
              height={150}
              className="rounded-md object-cover"
            />
          </a>
        </div>
      )
    } else if (isVideo) {
      return (
        <div className="mt-2">
          <video src={attachment.url} controls className="rounded-md max-w-[200px]" />
        </div>
      )
    } else {
      return (
        <div className="mt-2">
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <File size={16} className="mr-2 text-blue-500" />
            <span className="text-sm text-blue-500 truncate">{attachment.name}</span>
          </a>
        </div>
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-4">
        <div className="flex items-center space-x-3">
          <h2 className="font-medium">{chat.name}</h2>
          <div className="text-xs text-gray-500">{chat.participants.join(", ")}</div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-gray-500">
            <RefreshCw size={16} />
          </button>
          <button className="text-gray-500">
            <HelpCircle size={16} />
          </button>
          <div className="flex items-center space-x-1">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-gray-500">5 / 6 phones</span>
            <span className="text-xs text-gray-500">?</span>
          </div>
          <button className="text-gray-500">
            <Maximize2 size={16} />
          </button>
          <button className="text-gray-500">
            <Bell size={16} />
          </button>
          <button className="text-gray-500">
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {chat.messages.map((message, index) => {
          const user = users.find((u) => u.name === message.sender)
          const isCurrentUser = currentUser && message.sender === currentUser.name
          const showDate =
            index === 0 ||
            new Date(message.timestamp).toDateString() !== new Date(chat.messages[index - 1].timestamp).toDateString()

          // Use both message ID and index to ensure uniqueness
          const messageKey = message.id ? `${message.id}-${index}` : `msg-${index}`

          return (
            <div key={messageKey} className="mb-6">
              {showDate && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white px-3 py-1 rounded-full text-xs text-gray-500 shadow-sm">
                    {formatMessageDate(message.timestamp)}
                  </div>
                </div>
              )}

              <div className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} mb-2`}>
                {!isCurrentUser && user && (
                  <div className="mr-2 flex-shrink-0">
                    {user.avatar ? (
                      <Image
                        src={user.avatar || "/placeholder.svg?height=32&width=32"}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">{user.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={`max-w-[70%]`}>
                  {!isCurrentUser && (
                    <div className="flex items-center mb-1">
                      <span className="text-xs font-medium text-green-600 mr-2">{message.sender}</span>
                      {user?.phone && <span className="text-xs text-gray-500">+{user.phone}</span>}
                    </div>
                  )}

                  <div
                    className={cn(
                      "rounded-lg px-3 py-2",
                      isCurrentUser ? "bg-green-100 text-green-800" : "bg-white border text-gray-800",
                    )}
                  >
                    <p className="text-sm">{message.content}</p>

                    {/* Render attachments if any */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2">
                        {message.attachments.map((attachment, i) => (
                          <div key={attachment.id || i}>{renderAttachment(attachment)}</div>
                        ))}
                      </div>
                    )}

                    <div
                      className={`text-xs mt-1 ${isCurrentUser ? "text-green-600" : "text-gray-500"} flex justify-end items-center`}
                    >
                      {formatTime(message.timestamp)}
                      {isCurrentUser && <span className="ml-1">✓</span>}
                    </div>
                  </div>

                  {isCurrentUser && message.email && (
                    <div className="text-xs text-green-600 mt-1 text-right">{message.email}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="border-t p-2 bg-gray-50 flex flex-wrap">
          {attachments.map((file, index) => renderAttachmentPreview(file, index))}
        </div>
      )}

      {/* Message input */}
      <div className="border-t">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 text-sm ${activeTab === "WhatsApp" ? "text-green-600 border-b-2 border-green-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("WhatsApp")}
          >
            WhatsApp
          </button>
          <button
            className={`px-4 py-2 text-sm ${activeTab === "Private Note" ? "text-yellow-600 border-b-2 border-yellow-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("Private Note")}
          >
            Private Note
          </button>
        </div>
        <div className="p-3 flex items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Message..."
              className="w-full p-2 outline-none text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isUploading}
            />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              multiple
              accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
          </div>
          <div className="flex items-center space-x-3 text-gray-500">
            <button onClick={triggerFileInput} disabled={isUploading}>
              <Paperclip size={20} />
            </button>
            <button disabled={isUploading}>
              <Smile size={20} />
            </button>
            <button disabled={isUploading}>
              <Clock size={20} />
            </button>
            <button onClick={triggerFileInput} disabled={isUploading}>
              <ImageIcon size={20} />
            </button>
            <button disabled={isUploading}>
              <Mic size={20} />
            </button>
            <button
              className={cn("text-green-600", isUploading && "opacity-50")}
              onClick={handleSendMessage}
              disabled={isUploading || (!message.trim() && attachments.length === 0)}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
