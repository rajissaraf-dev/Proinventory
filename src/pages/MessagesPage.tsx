// src/pages/MessagesPage.tsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdSend, MdMessage, MdSearch, MdPeople, 
  MdCheck, MdDoneAll, MdMoreVert, MdRefresh
} from "react-icons/md";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import useAppSelector from "../hooks/useAppSelector";
import useAppDispatch from "../hooks/useAppDispatch";
import { toggleSidebar } from "../features/ui/uiSlice";
import useMessages from "../hooks/useMessages";
import { CompanyUserService } from "../services/company-user.service";
import { UserProfile } from "../types";

const MessagesPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector((state) => state.ui?.sidebarCollapsed ?? false);
  const userId = useAppSelector((state) => state.auth.user?.uid ?? "");
  const companyId = useAppSelector((state) => state.auth.profile?.companyId ?? "");
  
  const { 
    conversations, 
    messages, 
    selectedConversationId, 
    unreadCount,
    sendMessage, 
    selectConversation,
    getParticipantName,
    getParticipantRole,
    isLoading,
  } = useMessages();

  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sidebarWidth = isSidebarCollapsed ? 64 : 220;
  const handleToggleSidebar = () => dispatch(toggleSidebar());

  // ─── Load users for new chat ───
  useEffect(() => {
    if (!companyId) return;
    
    const loadUsers = async () => {
      try {
        const usersList = await CompanyUserService.list(companyId);
        setUsers(usersList);
      } catch (error) {
        console.error("Failed to load users:", error);
      }
    };
    loadUsers();
  }, [companyId]);

  // ─── Scroll to bottom on new messages ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Auto-focus input when conversation changes ───
  useEffect(() => {
    if (selectedConversationId) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [selectedConversationId]);

  // ─── Handle send message ───
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId) return;

    const conv = conversations.find((c) => c.id === selectedConversationId);
    if (!conv) return;

    const success = await sendMessage(conv.participantId, messageInput.trim());
    if (success) {
      setMessageInput("");
      inputRef.current?.focus();
    }
  };

  // ─── Handle key press (Enter to send) ───
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // ─── Handle new conversation selection ───
  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
  };

  // ─── Start new conversation with user ───
  const handleStartNewChat = (user: UserProfile) => {
    // Check if conversation already exists
    const existing = conversations.find((c) => c.participantId === user.uid);
    if (existing) {
      handleSelectConversation(existing.id);
      setShowNewChat(false);
      return;
    }

    // Create a temporary conversation ID
    const tempId = `temp_${userId}_${user.uid}`;
    selectConversation(tempId);
    setShowNewChat(false);
  };

  // ─── Filter conversations by search ───
  const filteredConversations = conversations.filter((conv) =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Get selected conversation details ───
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // ─── Check if selected conversation is a temporary one (new chat) ───
  const isTempConversation = selectedConversationId?.startsWith('temp_') ?? false;

  // ─── Get participant details ───
  let participantName = "";
  let participantRole = "";

  if (selectedConversation) {
    participantName = getParticipantName(selectedConversation.id);
    participantRole = getParticipantRole(selectedConversation.id);
  } else if (isTempConversation) {
    // For temp conversations, extract the other user ID
    const parts = selectedConversationId?.split('_') || [];
    const otherUserId = parts.find(id => id !== userId) || '';
    const user = users.find(u => u.uid === otherUserId);
    participantName = user?.displayName || "New User";
    participantRole = user?.role || "staff";
  }

  // ─── Show loading state ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-app)" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "var(--color-brand-primary)" }} />
          <p className="text-sm mt-4" style={{ color: "var(--color-text-muted)" }}>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--color-bg-app)" }}>
      <DashboardSidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeView="dashboard"
        messageCount={unreadCount}
        onAlertsClick={() => navigate("/dashboard?tab=notifications")}
      />

      <DashboardHeader
        onMenuClick={handleToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        onNotificationClick={() => navigate("/dashboard?tab=notifications")}
      />

      <main
        className="transition-all duration-300 pt-14 min-h-screen"
        style={{
          marginLeft: `${sidebarWidth}px`,
          width: `calc(100% - ${sidebarWidth}px)`,
          background: "var(--color-bg-app)",
        }}
      >
        <div className="h-full max-h-[calc(100vh-3.5rem)]">
          <div className="flex h-[calc(100vh-4rem)]">
            
            {/* ─── Conversations List ─── */}
            <div
              className="w-80 border-r flex flex-col"
              style={{ borderColor: "var(--color-border-soft)" }}
            >
              {/* Header */}
              <div
                className="p-4 border-b flex items-center justify-between"
                style={{ borderColor: "var(--color-border-soft)" }}
              >
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Messages
                  </h2>
                  <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                    {conversations.length} conversations
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowNewChat(!showNewChat)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-3"
                    style={{ color: "var(--color-brand-primary-soft)" }}
                    title="New conversation"
                  >
                    <MdPeople size={18} />
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-3"
                    style={{ color: "var(--color-text-muted)" }}
                    title="Refresh"
                  >
                    <MdRefresh size={16} />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="p-3">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--color-input-bg)",
                    border: "1px solid var(--color-input-border)",
                  }}
                >
                  <MdSearch size={14} style={{ color: "var(--color-input-icon)" }} />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "var(--color-input-text)" }}
                  />
                </div>
              </div>

              {/* New Chat */}
              {showNewChat && (
                <div className="px-3 pb-3">
                  <div
                    className="rounded-lg p-2 max-h-40 overflow-y-auto"
                    style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
                  >
                    {users
                      .filter((u) => u.uid !== userId)
                      .map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => handleStartNewChat(u)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:bg-surface-3"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{ background: "var(--color-brand-primary-soft)", color: "var(--color-brand-primary)" }}
                          >
                            {u.displayName?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                              {u.displayName || "Unknown User"}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                              {u.role?.replace("_", " ") || "staff"}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <MdMessage size={32} style={{ color: "var(--color-text-faint)" }} />
                    <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
                      No conversations yet
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      Click the people icon to start a new conversation
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                        selectedConversationId === conv.id ? "bg-surface-2" : ""
                      }`}
                      style={{
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                        style={{ background: "var(--color-brand-primary-soft)", color: "var(--color-brand-primary)" }}
                      >
                        {conv.participantName[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                            {conv.participantName}
                          </p>
                          <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                            {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                            {conv.lastMessageSenderId === userId ? "You: " : ""}
                            {conv.lastMessage}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span
                              className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1"
                              style={{ background: "var(--color-brand-primary)", color: "white" }}
                            >
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ─── Message Thread ─── */}
            <div className="flex-1 flex flex-col">
              {selectedConversationId ? (
                <>
                  {/* Chat Header */}
                  <div
                    className="p-4 border-b flex items-center justify-between"
                    style={{ borderColor: "var(--color-border-soft)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{ background: "var(--color-brand-primary-soft)", color: "var(--color-brand-primary)" }}
                      >
                        {participantName[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {participantName || "Loading..."}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                          {participantRole?.replace("_", " ") || "Staff"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                        {messages.length} messages
                      </span>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-3"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <MdMoreVert size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MdMessage size={32} style={{ color: "var(--color-text-faint)" }} />
                        <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
                          No messages yet
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                          Send a message to start the conversation
                        </p>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isOwn = msg.senderId === userId;
                        const showAvatar = index === 0 || messages[index - 1]?.senderId !== msg.senderId;

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex gap-2 max-w-[70%] ${isOwn ? "flex-row-reverse" : ""}`}
                            >
                              {!isOwn && showAvatar && (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-1"
                                  style={{ background: "var(--color-brand-primary-soft)", color: "var(--color-brand-primary)" }}
                                >
                                  {participantName[0]?.toUpperCase() || "U"}
                                </div>
                              )}
                              {!isOwn && !showAvatar && <div className="w-8 shrink-0" />}
                              
                              <div>
                                <div
                                  className={`rounded-2xl px-4 py-2 text-sm ${
                                    isOwn ? "rounded-br-sm" : "rounded-bl-sm"
                                  }`}
                                  style={{
                                    background: isOwn
                                      ? "var(--color-brand-primary)"
                                      : "var(--color-surface-2)",
                                    color: isOwn
                                      ? "white"
                                      : "var(--color-text-primary)",
                                    border: isOwn
                                      ? "none"
                                      : "1px solid var(--color-border-soft)",
                                  }}
                                >
                                  {msg.content}
                                </div>
                                <div
                                  className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                                    isOwn ? "justify-end" : "justify-start"
                                  }`}
                                  style={{ color: "var(--color-text-faint)" }}
                                >
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {isOwn && (msg.read ? <MdDoneAll size={12} /> : <MdCheck size={12} />)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* ─── Message Input Box ─── */}
                  <div
                    className="p-4 border-t"
                    style={{ borderColor: "var(--color-border-soft)" }}
                  >
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                        style={{
                          background: "var(--color-input-bg)",
                          border: "1px solid var(--color-input-border)",
                          color: "var(--color-input-text)",
                        }}
                        onFocus={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)";
                        }}
                        onBlur={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)";
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!messageInput.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                        style={{ background: "var(--color-brand-primary)", color: "white" }}
                      >
                        <MdSend size={18} />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <MdMessage size={48} style={{ color: "var(--color-text-faint)" }} className="mb-4" />
                  <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    No conversation selected
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Select a conversation from the list or start a new one
                  </p>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: "var(--color-brand-primary)", color: "white" }}
                  >
                    <MdPeople size={16} className="inline mr-2" />
                    Start New Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;