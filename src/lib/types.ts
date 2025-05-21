export interface User {
  id: string
  name: string
  avatar?: string
  phone?: string
  extension?: string
  email?: string
  status?: "online" | "offline"
}

export interface Attachment {
  id: string
  name: string
  url: string
  type: string
  size?: number
}

export interface Message {
  id?: string
  sender: string
  content: string
  timestamp: string
  email?: string
  attachments?: Attachment[]
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Chat {
  id: string
  name: string
  avatar?: string
  participants: string[]
  lastMessage: string
  lastMessageTime: string
  messages: Message[]
  status?: "online" | "offline"
  labels: Label[]
  phone: string
  extension?: string
  is_group?: boolean
  unreadCount?: number
}

export interface ChatParticipant {
  chat_id: string
  user_id: string
  last_read?: string
}

export interface ChatLabel {
  id?: string
  chat_id: string
  label_id?: string
  label?: string
}

export interface LabelRecord {
  id: string
  name: string
  color: string
  created_at?: string
}
