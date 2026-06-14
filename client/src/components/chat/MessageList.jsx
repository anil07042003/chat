import { useRef, useEffect } from "react";
import { useAppStore } from "../../store";
import MessageBubble from "./MessageBubble";
import Spinner from "../ui/Spinner";
import { IoChevronDown } from "react-icons/io5";
import moment from "moment";

const MessageList = ({ messages, hasMore, onLoadMore, loadingMore, messagesEndRef }) => {
  const { userInfo, selectedChatType } = useAppStore();
  const containerRef = useRef(null);
  const prevScrollHeight = useRef(0);

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    if (loadingMore && containerRef.current) {
      prevScrollHeight.current = containerRef.current.scrollHeight;
    }
  }, [loadingMore]);

  useEffect(() => {
    if (!loadingMore && prevScrollHeight.current && containerRef.current) {
      const diff = containerRef.current.scrollHeight - prevScrollHeight.current;
      containerRef.current.scrollTop += diff;
      prevScrollHeight.current = 0;
    }
  }, [messages.length, loadingMore]);

  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;
    msgs.forEach((msg) => {
      const msgDate = moment(msg.createdAt || msg.timestamp).format("YYYY-MM-DD");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: "date", date: msgDate, id: `date-${msgDate}` });
      }
      groups.push({ type: "message", message: msg, id: msg._id });
    });
    return groups;
  };

  const formatDateLabel = (dateStr) => {
    const date = moment(dateStr);
    const today = moment().startOf("day");
    const yesterday = moment().subtract(1, "day").startOf("day");
    if (date.isSame(today, "day")) return "Today";
    if (date.isSame(yesterday, "day")) return "Yesterday";
    if (date.isSame(moment(), "year")) return date.format("MMMM D");
    return date.format("MMMM D, YYYY");
  };

  const items = groupMessagesByDate(messages);

  return (
    /*
     * This div IS the scrollable area — it fills the grid row completely.
     * Do NOT add flex-1 here; the parent grid cell already sizes it.
     * h-full ensures it fills the grid cell even when messages are few.
     */
    <div
      ref={containerRef}
      className="h-full overflow-y-auto overflow-x-hidden px-3 py-3 md:px-4 md:py-4"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Load older messages */}
      {hasMore && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 text-sm text-nexchat-400 hover:text-nexchat-300 bg-surface-800 px-4 py-2 rounded-full transition-colors"
          >
            {loadingMore ? <Spinner size="sm" /> : <IoChevronDown size={16} />}
            {loadingMore ? "Loading..." : "Load older messages"}
          </button>
        </div>
      )}

      {/* Message items */}
      <div className="space-y-1">
        {items.map((item) => {
          if (item.type === "date") {
            return (
              <div key={item.id} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-surface-800" />
                <span className="text-xs text-surface-500 bg-surface-900 px-3 py-1 rounded-full border border-surface-800 whitespace-nowrap">
                  {formatDateLabel(item.date)}
                </span>
                <div className="flex-1 h-px bg-surface-800" />
              </div>
            );
          }

          const msg = item.message;
          const senderId = msg.sender?._id || msg.sender;
          const isMine = senderId === userInfo?.id;

          return (
            <MessageBubble
              key={item.id}
              message={msg}
              isMine={isMine}
              isGroup={selectedChatType === "group"}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center py-8">
          <div className="text-5xl mb-4">👋</div>
          <p className="text-surface-400 text-sm">No messages yet</p>
          <p className="text-surface-600 text-xs mt-1">Say hello to start the conversation!</p>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} className="h-px" />
    </div>
  );
};

export default MessageList;
