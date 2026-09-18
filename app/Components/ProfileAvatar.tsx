"use client";

import { useState } from "react";
import { serverUrl } from "@/lib/serverUrl";

function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) {
    return `${serverUrl.replace(/\/$/, "")}${trimmed}`;
  }
  return trimmed;
}

function initialsFrom(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export default function ProfileAvatar({
  src,
  name,
  size = 40,
  className = "",
  fallbackText,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  fallbackText?: string;
}) {
  const resolved = resolveAvatarUrl(src);
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(resolved) && !failed;
  const label = fallbackText || initialsFrom(name);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-gray-200 text-gray-600 font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved!}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        label
      )}
    </span>
  );
}
