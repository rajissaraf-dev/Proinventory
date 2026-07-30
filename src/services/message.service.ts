// src/services/message.service.ts

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  updateDoc,
  addDoc,
  QueryDocumentSnapshot,
  startAfter,
  getCountFromServer,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import db from "./firebase";
import { UserProfile } from "../types"; // ─── REMOVED: CompanyUser ───

export interface Message {
  id: string;
  companyId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName?: string;
  content: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  conversationId: string;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  companyId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageInput {
  companyId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  content: string;
  attachments?: string[];
}

export interface ConversationListItem {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastMessageSenderId: string;
  unreadCount: number;
  isOnline?: boolean;
}

const MESSAGES_COLLECTION = "messages";
const CONVERSATIONS_COLLECTION = "conversations";

export const MessageService = {
  /**
   * Generate a conversation ID from two user IDs (sorted alphabetically)
   */
  getConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  },

  /**
   * Get or create a conversation
   */
  async getOrCreateConversation(
    companyId: string,
    userId1: string,
    userId2: string
  ): Promise<string> {
    const conversationId = this.getConversationId(userId1, userId2);
    const ref = doc(db, "companies", companyId, CONVERSATIONS_COLLECTION, conversationId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Create new conversation
      await setDoc(ref, {
        id: conversationId,
        companyId,
        participants: [userId1, userId2],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadCount: 0,
      });
    }

    return conversationId;
  },

  /**
   * Send a message
   */
  async sendMessage(input: CreateMessageInput): Promise<Message> {
    const conversationId = this.getConversationId(input.senderId, input.recipientId);

    // Get or create conversation
    await this.getOrCreateConversation(
      input.companyId,
      input.senderId,
      input.recipientId
    );

    // Create message
    const messagesRef = collection(
      db,
      "companies",
      input.companyId,
      MESSAGES_COLLECTION
    );
    const docRef = await addDoc(messagesRef, {
      companyId: input.companyId,
      senderId: input.senderId,
      senderName: input.senderName,
      senderRole: input.senderRole,
      recipientId: input.recipientId,
      content: input.content,
      read: false,
      conversationId,
      createdAt: serverTimestamp(),
      attachments: input.attachments || [],
    });

    // Update conversation
    const conversationRef = doc(
      db,
      "companies",
      input.companyId,
      CONVERSATIONS_COLLECTION,
      conversationId
    );
    await updateDoc(conversationRef, {
      lastMessage: input.content,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: input.senderId,
      updatedAt: serverTimestamp(),
      unreadCount: input.senderId !== input.recipientId ? 1 : 0,
    });

    const newDoc = await getDoc(docRef);
    return {
      id: docRef.id,
      ...newDoc.data(),
    } as Message;
  },

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    companyId: string,
    conversationId: string,
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ): Promise<{ messages: Message[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      MESSAGES_COLLECTION
    );
    
    let q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    const messages = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Message[];

    const lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    const hasMore = snap.docs.length === pageSize;

    return {
      messages: messages.reverse(),
      lastDoc: lastVisible,
      hasMore,
    };
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      MESSAGES_COLLECTION
    );
    const q = query(
      messagesRef,
      where("recipientId", "==", userId),
      where("read", "==", false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },

  /**
   * Mark messages as read
   */
  async markAsRead(
    companyId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      MESSAGES_COLLECTION
    );
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      where("recipientId", "==", userId),
      where("read", "==", false)
    );
    const snap = await getDocs(q);

    const updates = snap.docs.map((doc) =>
      updateDoc(doc.ref, {
        read: true,
        readAt: serverTimestamp(),
      })
    );

    await Promise.all(updates);

    // Update conversation unread count
    const conversationRef = doc(
      db,
      "companies",
      companyId,
      CONVERSATIONS_COLLECTION,
      conversationId
    );
    await updateDoc(conversationRef, {
      unreadCount: 0,
    });
  },

  /**
   * Get conversations for a user
   */
  async getConversations(
    companyId: string,
    userId: string
  ): Promise<ConversationListItem[]> {
    const conversationsRef = collection(
      db,
      "companies",
      companyId,
      CONVERSATIONS_COLLECTION
    );
    const q = query(
      conversationsRef,
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    );

    const snap = await getDocs(q);
    const conversations: Conversation[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Conversation[];

    // Get user profiles for participants
    const result: ConversationListItem[] = [];
    for (const conv of conversations) {
      const otherUserId = conv.participants.find((id) => id !== userId);
      if (!otherUserId) continue;

      // Get user profile
      const userSnap = await getDoc(doc(db, "users", otherUserId));
      const userData = userSnap.exists() ? userSnap.data() as UserProfile : null;

      result.push({
        id: conv.id,
        participantId: otherUserId,
        participantName: userData?.displayName || "Unknown User",
        participantRole: userData?.role || "staff",
        lastMessage: conv.lastMessage || "",
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
        lastMessageSenderId: conv.lastMessageSenderId || "",
        unreadCount: conv.unreadCount || 0,
      });
    }

    return result;
  },

  /**
   * Subscribe to messages in a conversation (real-time)
   */
  subscribeToMessages(
    companyId: string,
    conversationId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      MESSAGES_COLLECTION
    );
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      callback(messages);
    });
  },

  /**
   * Subscribe to conversations (real-time)
   */
  subscribeToConversations(
    companyId: string,
    userId: string,
    callback: (conversations: ConversationListItem[]) => void
  ): Unsubscribe {
    const conversationsRef = collection(
      db,
      "companies",
      companyId,
      CONVERSATIONS_COLLECTION
    );
    const q = query(
      conversationsRef,
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    );

    return onSnapshot(q, async (snapshot) => {
      const convs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Conversation[];

      const result: ConversationListItem[] = [];
      for (const conv of convs) {
        const otherUserId = conv.participants.find((id) => id !== userId);
        if (!otherUserId) continue;

        const userSnap = await getDoc(doc(db, "users", otherUserId));
        const userData = userSnap.exists() ? userSnap.data() as UserProfile : null;

        result.push({
          id: conv.id,
          participantId: otherUserId,
          participantName: userData?.displayName || "Unknown User",
          participantRole: userData?.role || "staff",
          lastMessage: conv.lastMessage || "",
          lastMessageAt: conv.lastMessageAt || conv.createdAt,
          lastMessageSenderId: conv.lastMessageSenderId || "",
          unreadCount: conv.unreadCount || 0,
        });
      }

      callback(result);
    });
  },

  /**
   * Get total unread count for a user (for sidebar badge)
   */
  async getTotalUnreadCount(companyId: string, userId: string): Promise<number> {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      MESSAGES_COLLECTION
    );
    const q = query(
      messagesRef,
      where("recipientId", "==", userId),
      where("read", "==", false)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },
};