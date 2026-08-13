export type MessageRole =
  | "user"
  | "assistant";

export interface QuantumMessage {
  role: MessageRole;
  content: string;
  createdAt?: string;
}

export interface QuantumSource {
  title: string;
  url: string;
}

export interface QuantumConversation {
  _id?: string;
  userId: string;
  title: string;
  messages: QuantumMessage[];
  sources?: QuantumSource[];
  createdAt: Date;
  updatedAt: Date;
}