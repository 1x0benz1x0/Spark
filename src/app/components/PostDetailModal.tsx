"use client";
import { X } from "lucide-react";
import { PostCard, Post } from "./PostCard";

export function PostDetailModal({ post, currentUserId, onClose, onChange }: {
  post: Post;
  currentUserId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={onClose}>
      <div className="w-[min(92vw,600px)] max-h-[90vh] bg-black border border-zinc-800 rounded-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="font-semibold">Post</span>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <PostCard post={post} currentUserId={currentUserId} onChange={onChange} />
      </div>
    </div>
  );
}
