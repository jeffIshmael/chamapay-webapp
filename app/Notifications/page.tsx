"use client";

import React, { useCallback, useEffect, useState } from "react";
import BottomNavbar from "../Components/BottomNavbar";
import AppHeader from "../Components/AppHeader";
import {
  getUserDetails,
  transformNotification,
  confirmJoinRequest,
} from "../../lib/chamaService";
import { Notification as UINotification } from "@/utils/typesUtils";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { FiCheck, FiX, FiBell, FiClock, FiUserPlus } from "react-icons/fi";
import { showToast } from "../Components/Toast";
import Link from "next/link";

const NotificationSkeleton = () => (
  <div className="relative p-2.5 rounded-2xl border bg-white border-gray-200 shadow-sm animate-pulse flex items-start">
    <div className="p-2 rounded-lg mr-3 bg-gray-200 w-9 h-9" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/4" />
    </div>
  </div>
);

const Page = () => {
  const [activeSection, setActiveSection] = useState("Notifications");
  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loadingStates, setLoadingStates] = useState<
    Record<number, "approving" | "rejecting" | null>
  >({});
  const { isGuest } = useSessionAddress();
  const { token, isAuthenticated } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    if (isGuest || token === "guest") {
      setNotifications([]);
      return;
    }

    setFetching(true);
    try {
      const data = await getUserDetails(token);
      if (!data?.user) {
        setNotifications([]);
        return;
      }

      // Match Application: user.notifications + join requests for admin actions
      const joinReqs =
        (data.user.joinRequests?.length
          ? data.user.joinRequests
          : data.user.sentRequests) || [];

      const transformed = await transformNotification(
        data.user.notifications || [],
        joinReqs
      );
      setNotifications(transformed);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      showToast("Failed to fetch notifications.", "error");
      setNotifications([]);
    } finally {
      setFetching(false);
    }
  }, [token, isAuthenticated, isGuest]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleJoin = async (
    action: "approve" | "reject",
    requestId: number,
    chamaName: string
  ) => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in to manage requests", "warning");
      return;
    }

    setLoadingStates((prev) => ({
      ...prev,
      [requestId]: action === "approve" ? "approving" : "rejecting",
    }));

    try {
      const result = await confirmJoinRequest(requestId, action, token);
      if (!result?.success && result?.success !== undefined) {
        throw new Error(result?.error || `Failed to ${action}`);
      }
      showToast(
        action === "approve"
          ? `User successfully added to ${chamaName}`
          : `Request successfully rejected`,
        action === "approve" ? "success" : "error"
      );
      await loadNotifications();
    } catch (error) {
      showToast(`Failed to ${action} request`, "error");
      console.error(error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <AppHeader pageTitle="Notifications" />

      <div className="px-4 pt-3 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-gray-500">
            Activity from your chamas and goals
          </p>
          {notifications.length > 0 && (
            <span className="bg-downy-100 text-downy-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {notifications.filter((n) => !n.read).length || notifications.length}{" "}
              new
            </span>
          )}
        </div>

        {fetching ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-white border border-downy-100 p-4 rounded-2xl max-w-xs shadow-sm">
              <h3 className="text-[14px] font-bold text-gray-800">
                Sign in required
              </h3>
              <p className="text-[12px] text-gray-500 mt-1.5">
                Sign in to view notifications
              </p>
              <Link
                href="/"
                className="inline-block mt-3 bg-downy-600 text-white text-[12px] font-bold px-4 py-2 rounded-xl"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FiClock className="text-gray-300 text-4xl mb-3" />
            <h3 className="text-[14px] font-bold text-gray-800">
              No notifications yet
            </h3>
            <p className="text-[12px] text-gray-500 mt-1 max-w-[14rem]">
              You&apos;ll see activity here when something happens
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isJoinRequest = notification.type === "join_request";
              const requestId = notification.requestId ?? 0;
              const loading = loadingStates[requestId];

              return (
                <div
                  key={notification.id}
                  className={`relative p-2.5 rounded-2xl shadow-sm border ${
                    notification.read
                      ? "bg-white border-downy-100/70"
                      : "bg-downy-50 border-downy-200"
                  }`}
                >
                  {!notification.read && (
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-downy-500 rounded-full" />
                  )}

                  <div className="flex items-start">
                    <div
                      className={`p-1.5 rounded-lg mr-2.5 ${
                        isJoinRequest
                          ? "bg-purple-100 text-purple-600"
                          : "bg-downy-100 text-downy-600"
                      }`}
                    >
                      {isJoinRequest ? (
                        <FiUserPlus size={15} />
                      ) : (
                        <FiBell size={15} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-900 font-semibold leading-snug">
                        {notification.title}
                      </p>
                      <p className="text-[12px] text-gray-700 font-medium leading-snug mt-0.5">
                        {notification.message}
                      </p>

                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-[10px] text-gray-500">
                          {new Date(notification.timestamp).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                          {" • "}
                          {new Date(notification.timestamp).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                        {notification.chama ? (
                          <span className="text-[10px] text-downy-700 font-medium truncate max-w-[8rem]">
                            {notification.chama}
                          </span>
                        ) : null}
                      </div>

                      {isJoinRequest && requestId > 0 && (
                        <div className="mt-3 flex justify-end space-x-2">
                          <button
                            type="button"
                            disabled={Boolean(loading)}
                            onClick={() =>
                              handleJoin(
                                "approve",
                                requestId,
                                notification.chama || "chama"
                              )
                            }
                            className={`flex items-center px-3 py-1.5 bg-downy-600 text-white rounded-lg text-[12px] font-semibold ${
                              loading === "approving"
                                ? "opacity-70 cursor-wait"
                                : "hover:bg-downy-700"
                            }`}
                          >
                            <FiCheck className="mr-1" size={14} />
                            {loading === "approving" ? "Approving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(loading)}
                            onClick={() =>
                              handleJoin(
                                "reject",
                                requestId,
                                notification.chama || "chama"
                              )
                            }
                            className={`flex items-center px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[12px] font-semibold ${
                              loading === "rejecting"
                                ? "opacity-70 cursor-wait"
                                : "hover:bg-red-200"
                            }`}
                          >
                            <FiX className="mr-1" size={14} />
                            {loading === "rejecting" ? "Rejecting…" : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
};

export default Page;
