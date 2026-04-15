"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";

import { formatConversationTime } from "../lib/marketplace/format";

export default function MessagingWorkspace({
  currentUser,
  conversations,
  selectedConversation,
  messages,
  onSelectConversation,
  onBack,
  messageInput,
  onMessageInputChange,
  onAttachmentChange,
  attachmentPreview,
  onRemoveAttachment,
  onSendMessage,
  sendingMessage,
  messageError,
}) {
  const attachmentInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sortedConversations = useMemo(() => {
    return [...(conversations || [])].sort((left, right) => {
      const leftTime = left.lastMessageAt?.toMillis?.() || 0;
      const rightTime = right.lastMessageAt?.toMillis?.() || 0;
      return rightTime - leftTime;
    });
  }, [conversations]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Messages</h2>
          <p className="mt-1 text-slate-600">Keep booking questions and logistics in one polished thread.</p>
        </div>

        <button onClick={onBack} className="btn-secondary text-sm">
          Back to browse
        </button>
      </div>

      <div className="lux-msg-grid">
        <div className="card-premium overflow-hidden lux-msg-list md:col-span-1">
          <div className="gradient-blue p-5 text-white">
            <h3 className="text-lg font-bold">Conversations</h3>
            <p className="mt-1 text-sm text-white/80">Recent charter chats stay pinned up top.</p>
          </div>

          <div className="max-h-[680px] divide-y divide-sky-100 overflow-y-auto">
            {sortedConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-700">No conversations yet</p>
                <p className="mt-1 text-sm text-slate-500">Message an owner from a listing to start planning.</p>
              </div>
            ) : (
              sortedConversations.map((conversation) => {
                const otherUserId = (conversation.participantIds || []).find((id) => id !== currentUser?.uid);
                const otherName = conversation.participantNames?.[otherUserId] || "Owner";
                const isActive = selectedConversation?.id === conversation.id;
                const lastTimestamp = conversation.lastMessageAt?.toDate?.() || null;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => onSelectConversation(conversation)}
                    className={`w-full px-4 py-4 text-left transition ${
                      isActive ? "border-l-4 border-blue-600 bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{conversation.boatName || "Boat Charter"}</div>
                        <div className="mt-1 text-sm text-slate-600">with {otherName}</div>
                        <div className="mt-2 truncate text-xs text-slate-500">
                          {conversation.lastMessage || "No messages yet"}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] font-semibold text-slate-400">
                        {formatConversationTime(lastTimestamp)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card-premium overflow-hidden lux-msg-chat md:col-span-2">
          {selectedConversation ? (
            <div className="flex h-[680px] flex-col">
              <div className="gradient-blue p-5 text-white">
                <h3 className="text-lg font-bold">{selectedConversation.boatName || "Conversation"}</h3>
                <p className="mt-1 text-sm text-white/80">
                  Respond quickly so passengers feel confident before they book.
                </p>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4">
                {messages.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                    <p className="font-semibold text-slate-700">No messages yet</p>
                    <p className="mt-1 text-sm text-slate-500">Start the conversation with details about the charter.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.senderId === currentUser?.uid;
                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] md:max-w-[65%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          {!isMine ? (
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {message.senderName || "User"}
                            </div>
                          ) : null}

                          <div
                            className={`rounded-3xl px-4 py-3 shadow-sm ${
                              isMine
                                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                                : "border border-slate-200 bg-white text-slate-900"
                            }`}
                          >
                            {message.attachmentUrl ? (
                              <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mb-2 block">
                                <img src={message.attachmentUrl} alt="attachment" className="chat-attachment" />
                              </a>
                            ) : null}

                            {message.text ? <div className="whitespace-pre-wrap break-words">{message.text}</div> : null}
                            <div className={`mt-2 text-[11px] ${isMine ? "text-white/75" : "text-slate-400"}`}>
                              {formatConversationTime(message.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-sky-100 bg-white p-4">
                {messageError ? (
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {messageError}
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={attachmentInputRef}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      onAttachmentChange(file);
                      event.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={() => attachmentInputRef.current?.click()}
                    aria-label="Add attachment"
                  >
                    <Plus className="h-5 w-5" />
                  </button>

                  <div className="flex-1">
                    {attachmentPreview ? (
                      <div className="chat-attach-preview">
                        <img src={attachmentPreview} alt="attachment preview" />
                        <button type="button" className="chat-attach-remove" onClick={onRemoveAttachment} aria-label="Remove attachment">
                          x
                        </button>
                      </div>
                    ) : null}

                    <textarea
                      rows={attachmentPreview ? 2 : 1}
                      value={messageInput}
                      onChange={(event) => onMessageInputChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          onSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={onSendMessage}
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-3 text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={sendingMessage}
                    aria-label="Send message"
                  >
                    {sendingMessage ? <span className="text-sm font-bold">...</span> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[680px] items-center justify-center">
              <div className="max-w-sm text-center">
                <MessageCircle className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-800">Select a conversation</h3>
                <p className="mt-2 text-slate-500">Your inbox stays organized by boat so each charter request is easy to follow.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
