// src/features/messaging/messagingSlice.ts

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Message, ConversationListItem } from "../../services/message.service";

interface MessagingState {
  conversations: ConversationListItem[];
  messages: Record<string, Message[]>; // conversationId -> messages[]
  selectedConversationId: string | null;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: MessagingState = {
  conversations: [],
  messages: {},
  selectedConversationId: null,
  unreadCount: 0,
  isLoading: false,
  error: null,
};

const messagingSlice = createSlice({
  name: "messaging",
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<ConversationListItem[]>) => {
      state.conversations = action.payload;
    },
    addConversation: (state, action: PayloadAction<ConversationListItem>) => {
      const existing = state.conversations.findIndex(
        (c) => c.id === action.payload.id
      );
      if (existing >= 0) {
        state.conversations[existing] = action.payload;
      } else {
        state.conversations = [action.payload, ...state.conversations];
      }
    },
    setMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: Message[] }>
    ) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },
    addMessage: (
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>
    ) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId] = [...state.messages[conversationId], message];
    },
    setSelectedConversation: (state, action: PayloadAction<string | null>) => {
      state.selectedConversationId = action.payload;
    },
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    markMessagesAsRead: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        state.messages[conversationId] = messages.map((m) => ({
          ...m,
          read: true,
        }));
      }
      // Update conversation unread count
      const conv = state.conversations.find((c) => c.id === conversationId);
      if (conv) {
        conv.unreadCount = 0;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearMessages: (state) => {
      state.messages = {};
      state.selectedConversationId = null;
    },
  },
});

export const {
  setConversations,
  addConversation,
  setMessages,
  addMessage,
  setSelectedConversation,
  setUnreadCount,
  markMessagesAsRead,
  setLoading,
  setError,
  clearMessages,
} = messagingSlice.actions;

export default messagingSlice.reducer;