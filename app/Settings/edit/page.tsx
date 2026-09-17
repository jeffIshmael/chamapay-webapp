"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiCamera,
  FiMail,
  FiPhone,
  FiUser,
} from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "@/app/Components/Toast";
import { serverUrl } from "@/lib/serverUrl";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isGuest, refreshUser, updateLocalUser } =
    useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phoneNo, setPhoneNo] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
    else if (isGuest) router.replace("/Settings");
  }, [isAuthenticated, isGuest, router]);

  useEffect(() => {
    if (!user) return;
    setPhoneNo(user.phoneNo != null ? String(user.phoneNo) : "");
    setProfileImageUrl((user.profileImageUrl as string) || "");
  }, [user]);

  const displayName = user?.userName?.trim() || "User";
  const avatar = profileImageUrl || user?.profileImageUrl || "";

  const validate = () => {
    if (phoneNo.trim()) {
      const digits = phoneNo.replace(/\D/g, "");
      if (!/^\d{10,15}$/.test(digits)) {
        setPhoneError("Enter a valid phone number (10–15 digits)");
        return false;
      }
    }
    setPhoneError("");
    return true;
  };

  const uploadImage = async (file: File) => {
    if (!token || token === "guest") return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`${serverUrl}/user/profile/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }
      const url = data.profileImageUrl as string;
      setProfileImageUrl(url);
      updateLocalUser({ profileImageUrl: url });
      await refreshUser();
      showToast("Profile photo updated", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!validate() || !token || token === "guest") return;
    setLoading(true);
    try {
      const digits = phoneNo.replace(/\D/g, "");
      const response = await fetch(`${serverUrl}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNo: digits ? parseInt(digits, 10) : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Update failed");
      }
      updateLocalUser({ phoneNo: digits || null });
      await refreshUser();
      showToast("Profile updated", "success");
      router.back();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    phoneNo.replace(/\D/g, "") !==
    String(user?.phoneNo ?? "").replace(/\D/g, "");

  return (
    <div className="flex flex-col bg-gray-50 min-h-full pb-10">
      <div className="sticky top-0 z-40 bg-gradient-to-br from-downy-800 to-emerald-900 px-5 pt-3 pb-8 rounded-b-3xl text-white safe-top shadow-md shadow-downy-900/20">
        <div className="flex items-center justify-between min-h-[40px]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
          >
            <FiArrowLeft size={18} />
          </button>
          <h1 className="text-display text-[17px] font-bold">Edit Profile</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 -mt-5 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[15px] font-bold text-gray-900">Profile Picture</p>
          <p className="text-sm text-gray-500 mb-4">Update your profile photo</p>

          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-gray-100 bg-downy-100 text-downy-800 flex items-center justify-center text-2xl font-bold">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt=""
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials(displayName)
                )}
              </div>
              {imageUploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <span className="h-7 w-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-downy-600 border-2 border-white flex items-center justify-center text-white">
                <FiCamera size={14} />
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={imageUploading}
              onClick={() => fileRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-downy-700 px-5 py-2.5 text-white text-sm font-semibold disabled:bg-gray-300"
            >
              <FiCamera size={16} />
              {imageUploading ? "Uploading…" : "Change Photo"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-[15px] font-bold text-gray-900 mb-3">
              Personal Information
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
              <FiUser size={12} /> Username
            </span>
            <input
              value={displayName}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
              <FiMail size={12} /> Email
            </span>
            <input
              value={user?.email || ""}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
              <FiPhone size={12} /> Phone
            </span>
            <input
              value={phoneNo}
              onChange={(e) => setPhoneNo(e.target.value)}
              placeholder="e.g. 0712345678"
              inputMode="tel"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-downy-400/40 focus:border-downy-400"
            />
            {phoneError ? (
              <p className="mt-1 text-xs text-red-600">{phoneError}</p>
            ) : null}
          </label>
        </div>

        <button
          type="button"
          disabled={loading || !hasChanges}
          onClick={() => void handleSave()}
          className="w-full rounded-xl bg-downy-700 py-3.5 text-white font-bold text-[15px] disabled:bg-gray-300 disabled:text-gray-500"
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
