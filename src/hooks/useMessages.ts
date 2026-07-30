// src/hooks/useMessages.ts

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import { MessageService } from "../services/message.service"; // ─── REMOVED: Message, ConversationListItem ───
import {
  setConversations,
  setMessages,
  setSelectedConversation,
  setUnreadCount,
  markMessagesAsRead,
  setLoading,
} from "../features/messaging/messagingSlice"; // ─── REMOVED: addMessage, setError ───

export const useMessages = () => {
  const dispatch = useDispatch();
  const companyId = useSelector((state: RootState) => state.auth.profile?.companyId ?? "");
  const userId = useSelector((state: RootState) => state.auth.user?.uid ?? "");
  const { conversations, messages, selectedConversationId, unreadCount } = useSelector(
    (state: RootState) => state.messaging
  );
  const [unsubscribeConversations, setUnsubscribeConversations] = useState<(() => void) | null>(null);
  const [unsubscribeMessages, setUnsubscribeMessages] = useState<(() => void) | null>(null);
  const selectedConvIdRef = useRef<string | null>(null);

  // ─── Get user profile from Redux ───
  const userProfile = useSelector((state: RootState) => state.auth.profile);

  // ─── Subscribe to conversations ───
  useEffect(() => {
    if (!companyId || !userId) return;

    // Clean up previous subscription
    if (unsubscribeConversations) {
      unsubscribeConversations();
    }

    dispatch(setLoading(true));

    const unsubscribe = MessageService.subscribeToConversations(
      companyId,
      userId,
      async (convs) => {
        dispatch(setConversations(convs));
        
        // Update unread count
        const totalUnread = convs.reduce((sum, c) => sum + c.unreadCount, 0);
        dispatch(setUnreadCount(totalUnread));

        // Auto-select first conversation if none selected
        if (!selectedConvIdRef.current && convs.length > 0) {
          dispatch(setSelectedConversation(convs[0].id));
        }

        dispatch(setLoading(false));
      }
    );

    setUnsubscribeConversations(() => unsubscribe);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [companyId, userId]);

  // ─── Subscribe to messages in selected conversation ───
  useEffect(() => {
    if (!companyId || !selectedConversationId) return;

    // Clean up previous subscription
    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    selectedConvIdRef.current = selectedConversationId;

    const unsubscribe = MessageService.subscribeToMessages(
      companyId,
      selectedConversationId,
      (messages) => {
        dispatch(setMessages({ conversationId: selectedConversationId, messages }));
        
        // Mark messages as read when conversation is open
        if (messages.some((m) => !m.read && m.recipientId === userId)) {
          MessageService.markAsRead(companyId, selectedConversationId, userId);
          dispatch(markMessagesAsRead(selectedConversationId));
          
          // Update unread count
          MessageService.getTotalUnreadCount(companyId, userId).then((count) => {
            dispatch(setUnreadCount(count));
          });
        }
      }
    );

    setUnsubscribeMessages(() => unsubscribe);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [companyId, selectedConversationId, userId]);

  // ─── Send message ───
  const sendMessage = useCallback(
    async (recipientId: string, content: string) => {
      if (!companyId || !userId) return false;

      try {
        // ─── Use userProfile from Redux instead of fetching ───
        const senderName = userProfile?.displayName || "User";
        const senderRole = userProfile?.role || "staff";
        
        await MessageService.sendMessage({
          companyId,
          senderId: userId,
          senderName,
          senderRole,
          recipientId,
          content,
        });
        return true;
      } catch (error) {
        console.error("Failed to send message:", error);
        return false;
      }
    },
    [companyId, userId, userProfile]
  );

  // ─── Select conversation ───
  const selectConversation = useCallback(
    (conversationId: string) => {
      dispatch(setSelectedConversation(conversationId));
    },
    [dispatch]
  );

  // ─── Get messages for current conversation ───
  const getCurrentMessages = useCallback(() => {
    if (!selectedConversationId) return [];
    return messages[selectedConversationId] || [];
  }, [messages, selectedConversationId]);

  // ─── Get conversation participant name ───
  const getParticipantName = useCallback(
    (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      return conv?.participantName || "Unknown User";
    },
    [conversations]
  );

  // ─── Get conversation participant role ───
  const getParticipantRole = useCallback(
    (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      return conv?.participantRole || "staff";
    },
    [conversations]
  );

  // ─── Get unread count for a conversation ───
  const getConversationUnreadCount = useCallback(
    (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      return conv?.unreadCount || 0;
    },
    [conversations]
  );

  return {
    conversations,
    messages: getCurrentMessages(),
    selectedConversationId,
    unreadCount,
    sendMessage,
    selectConversation,
    getParticipantName,
    getParticipantRole,
    getConversationUnreadCount,
    getCurrentMessages,
    isLoading: useSelector((state: RootState) => state.messaging.isLoading),
  };
};

export default useMessages;