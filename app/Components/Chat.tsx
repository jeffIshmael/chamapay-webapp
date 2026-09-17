"use client";

import React, { useEffect, useRef, useState } from "react";
import { getMessages, saveMessageToDb } from "@/lib/chamaService";
import { Message } from "@/utils/typesUtils";
import { useAuth } from "@/app/context/AuthContext";
import { IoMdSend } from "react-icons/io";

interface ChatMessage {
  id: number;
  text: string;
  sender: string;
  senderId: number;
  timestamp: string;
  isAdmin?: boolean;
}

interface ChatProps {
  chamaId: number;
}

const Chat: React.FC<ChatProps> = ({ chamaId }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { token, user } = useAuth();

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamaId, token]);

  const fetchMessages = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await getMessages(chamaId, token);
      if (response.success && response.messages) {
        const formatted = response.messages.map((msg: Message) => ({
          id: Number(msg.id),
          text: msg.text,
          sender:
            typeof msg.sender === "string"
              ? msg.sender
              : (msg.sender as unknown as { userName?: string })?.userName ||
                "Member",
          senderId: msg.senderId,
          timestamp: msg.timestamp,
          isAdmin: msg.isAdmin,
        }));
        formatted.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(formatted);
        setError(null);
      } else {
        setError(response.error || "Failed to load messages");
      }
    } catch {
      setError("Failed to load messages. Please try again.");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const isMyMessage = (msg: ChatMessage) => {
    if (!user) return false;
    if (msg.senderId && user.id) return msg.senderId === user.id;
    return msg.sender === user.userName;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDayLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const yesterdayOnly = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );
    if (dateOnly.getTime() === todayOnly.getTime()) return "Today";
    if (dateOnly.getTime() === yesterdayOnly.getTime()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const isSameDay = (a: string, b: string) => {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const shouldGroup = (a: ChatMessage, b: ChatMessage) => {
    if (a.sender !== b.sender && a.senderId !== b.senderId) return false;
    if (!isSameDay(a.timestamp, b.timestamp)) return false;
    const diff =
      Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) /
      60000;
    return diff < 2;
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || isSending || !user?.id || !token) return;

    const text = message.trim();
    const tempId = Date.now();
    const optimistic: ChatMessage = {
      id: tempId,
      text,
      sender: user.userName || "You",
      senderId: user.id,
      timestamp: new Date().toISOString(),
    };

    setIsSending(true);
    setMessages((prev) => [...prev, optimistic]);
    setMessage("");
    scrollToBottom();
    inputRef.current?.focus();

    try {
      const response = await saveMessageToDb(token, user.id, text, chamaId);
      if (!response.success) throw new Error(response.error || "Failed");
    } catch {
      setError("Message failed to send. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        100
      )}px`;
    }
  }, [message]);

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-3"
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-pulse flex space-x-2">
              <div className="w-2.5 h-2.5 bg-downy-300 rounded-full" />
              <div className="w-2.5 h-2.5 bg-downy-400 rounded-full" />
              <div className="w-2.5 h-2.5 bg-downy-500 rounded-full" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg text-center text-[12px]">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <IoMdSend className="text-emerald-600 text-2xl" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-800 mb-1">
              No messages yet
            </h3>
            <p className="text-[12px] text-gray-500">
              Start the conversation with your chama members
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const mine = isMyMessage(msg);
            const prev = index > 0 ? messages[index - 1] : null;
            const next = index < messages.length - 1 ? messages[index + 1] : null;
            const showDate = !prev || !isSameDay(prev.timestamp, msg.timestamp);
            const firstInGroup = !prev || !shouldGroup(prev, msg);
            const lastInGroup = !next || !shouldGroup(msg, next);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="bg-gray-200 text-gray-700 text-[10px] font-semibold px-3 py-1 rounded-full">
                      {getDayLabel(msg.timestamp)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${mine ? "justify-end" : "justify-start"} ${
                    firstInGroup ? "mt-3" : "mt-1"
                  }`}
                >
                  <div
                    className={`flex flex-col ${
                      mine ? "items-end" : "items-start"
                    } max-w-[80%]`}
                  >
                    {!mine && firstInGroup && (
                      <span
                        className={`text-[11px] font-bold mb-1 px-1 ${
                          msg.isAdmin ? "text-emerald-700" : "text-gray-700"
                        }`}
                      >
                        {msg.sender}
                      </span>
                    )}
                    <div
                      className={`px-3.5 py-2.5 shadow-sm ${
                        mine
                          ? "bg-emerald-600 text-white"
                          : msg.isAdmin
                            ? "bg-emerald-100 border border-emerald-200 text-gray-900"
                            : "bg-white border border-gray-200 text-gray-900"
                      } ${
                        mine
                          ? firstInGroup && lastInGroup
                            ? "rounded-2xl rounded-br-md"
                            : firstInGroup
                              ? "rounded-2xl rounded-br-md"
                              : lastInGroup
                                ? "rounded-2xl rounded-tr-md"
                                : "rounded-2xl rounded-r-md"
                          : firstInGroup && lastInGroup
                            ? "rounded-2xl rounded-bl-md"
                            : firstInGroup
                              ? "rounded-2xl rounded-bl-md"
                              : lastInGroup
                                ? "rounded-2xl rounded-tl-md"
                                : "rounded-2xl rounded-l-md"
                      }`}
                    >
                      <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                      {lastInGroup && (
                        <p
                          className={`text-[10px] mt-1 text-right ${
                            mine ? "text-white/75" : "text-gray-400"
                          }`}
                        >
                          {formatTime(msg.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white p-3 border-t border-gray-200 shrink-0">
        <form onSubmit={sendMessage} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 p-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none max-h-24 text-[13px]"
            style={{ minHeight: "44px" }}
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className={`p-2.5 rounded-full shrink-0 ${
              message.trim()
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            <IoMdSend className="text-lg" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
