"use client";

import React, { useEffect, useState } from "react";
import BottomNavbar from "../Components/BottomNavbar";
import AppHeader from "../Components/AppHeader";
import {
  getUserDetails,
  transformNotification,
  confirmJoinRequest,
  getMiniappNotifications,
} from "../../lib/chamaService";
import {
} from "../../lib/chama";
import { Notification as UINotification } from "@/utils/typesUtils";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { toast } from "sonner";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { FiCheck, FiX, FiBell, FiClock, FiUserPlus } from "react-icons/fi";
import { showToast } from "../Components/Toast";
import Link from "next/link";

interface Chama {
  adminId: number;
  amount: bigint;
  createdAt: Date;
  cycleTime: number;
  id: number;
  maxNo: number;
  blockchainId: string;
  name: string;
  round: number;
  cycle: number;
  canJoin: boolean;
  payDate: Date;
  slug: string;
  startDate: Date;
  started: boolean;
  type: string;
}

interface Notification {
  id: number;
  message: string;
  senderId: number | null;
  requestId: number | null;
  read: boolean;
  createdAt: Date;
  chamaId: number | null;
  chama?: Chama;
}

interface Request {
  chama: Chama;
  chamaId: number;
  createdAt: Date;
  id: number;
  status: string;
  user: object;
  userId: number;
}

interface User {
  id: number;
  name: string | null;
  address: string;
  role: string;
}

const NotificationSkeleton = () => (
  <div className="relative p-2 rounded-xl border bg-white border-gray-200 shadow-sm animate-pulse flex items-start">
    <div className="p-2 rounded-lg mr-3 bg-gray-200 w-9 h-9"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-100 rounded w-1/4"></div>
    </div>
  </div>
);

const Page = () => {
  const [activeSection, setActiveSection] = useState("Notifications");
  const [userId, setUserId] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState<
    Record<number, "approving" | "rejecting" | null>
  >({});
  const { isConnected, address, isGuest } = useSessionAddress();
  const { token, isAuthenticated } = useAuth();

  // Fetch unified data when token changes
  useEffect(() => {
    const fetchData = async () => {
      if (!token || !isAuthenticated) return;
      if (isGuest || token === "guest") {
        setNotifications([]);
        setPendingRequests([]);
        return;
      }

      setFetching(true);
      try {
        const data = await getUserDetails(token);
        if (data && data.user) {
          setUserId(data.user.id);

          // Fetch notifications using the new miniapp-specific endpoint
          const miniappNotifications = await getMiniappNotifications(data.user.id, token);

          // Transform only join requests into unified format (passing empty array for notifications)
          const transformedRequests = await transformNotification(
            [],
            data.user.joinRequests || []
          );

          const transformed = [...miniappNotifications, ...transformedRequests];

          // Map the UI-friendly notifications to the component's state
          // The component expects the Notification interface defined at line 39
          setNotifications(transformed.map(n => ({
            id: Number(n.id.replace('request-', '')), // Fallback for ID handling
            message: n.message,
            senderId: n.requestUserId || null,
            requestId: n.requestId || null,
            read: n.read,
            createdAt: new Date(n.timestamp),
            chamaId: n.chamaId || null,
            chama: n.chama ? { name: n.chama } as any : undefined
          })));

          setPendingRequests(data.user.joinRequests || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch notifications.");
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [token, isAuthenticated, isGuest]);

  useEffect(() => {
    console.log("Current loadingStates:", loadingStates);
  }, [loadingStates]);

  const handleJoin = async (
    action: "approve" | "reject",
    chamaBlockchainId: number,
    chamaId: number,
    chamaName: string,
    senderId: number,
    requestId: number,
    canJoin: boolean,
    userAddress?: string
  ) => {
    if (!isAuthenticated || !token) {
      toast.error("Please sign in to manage requests");
      return;
    }

    // Set loading state for this specific request
    setLoadingStates((prev) => ({
      ...prev,
      [requestId]: action === "approve" ? "approving" : "rejecting",
    }));

    try {
      const result = await confirmJoinRequest(requestId, action, token!);
      if (!result?.success && result?.success !== undefined) {
        throw new Error(result?.error || `Failed to ${action}`);
      }
      showToast(
        action === "approve"
          ? `User successfully added to ${chamaName}`
          : `Request successfully rejected`,
        action === "approve" ? "success" : "error"
      );

      // Refetch data
      if (token && isAuthenticated) {
        const data = await getUserDetails(token);
        if (data && data.user) {
          const miniappNotifications = await getMiniappNotifications(data.user.id, token);
          const transformedRequests = await transformNotification(
            [],
            data.user.joinRequests || []
          );
          const transformed = [...miniappNotifications, ...transformedRequests];
          setNotifications(transformed.map(n => ({
            id: Number(n.id.replace('request-', '')),
            message: n.message,
            senderId: n.requestUserId || null,
            requestId: n.requestId || null,
            read: n.read,
            createdAt: new Date(n.timestamp),
            chamaId: n.chamaId || null,
            chama: n.chama ? { name: n.chama } as any : undefined
          })));
          setPendingRequests(data.user.joinRequests || []);
        }
      }
    } catch (error) {
      showToast(`Failed to ${action} request`, "error");
      console.log(error);
    } finally {
      // Clear loading state for this request
      setLoadingStates((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  const pendingRequestIds = new Set(pendingRequests.map((req) => req.id));

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <AppHeader eyebrow="Inbox" title="Alerts" />

      <div className="px-4 pt-3 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-gray-500">
            Activity from your chamas and goals
          </p>
          {notifications.length > 0 && (
            <span className="bg-downy-100 text-downy-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {notifications.length} new
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
              const isPending =
                notification.requestId !== null &&
                pendingRequestIds.has(notification.requestId);

              return (
                <div
                  key={notification.id}
                  className={`relative p-2.5 rounded-2xl shadow-sm border ${notification.read
                    ? "bg-white border-downy-100/70"
                    : "bg-downy-50 border-downy-200"
                    }`}
                >
                  {!notification.read && (
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-downy-500 rounded-full"></div>
                  )}

                  <div className="flex items-start">
                    <div
                      className={`p-1.5 rounded-lg mr-2.5 ${isPending
                        ? "bg-purple-100 text-purple-600"
                        : "bg-downy-100 text-downy-600"
                        }`}
                    >
                      {isPending ? (
                        <FiUserPlus size={15} />
                      ) : (
                        <FiBell size={15} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-800 font-medium leading-snug">
                        {notification.message}
                      </p>

                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-[10px] text-gray-500 flex items-center">
                          {new Date(notification.createdAt).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                          {" • "}
                          {new Date(notification.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      {/* Approval buttons - moved below timestamp */}
                      {isPending && (
                        <div className="mt-3 flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              if (loadingStates[notification.requestId ?? 0])
                                return;
                              handleJoin(
                                "approve",
                                notification.chama
                                  ? Number(notification.chama.blockchainId)
                                  : 0,
                                notification.chamaId ?? 0,
                                notification.chama
                                  ? notification.chama.name
                                  : "",
                                notification.senderId ?? 0,
                                notification.requestId ?? 0,
                                notification.chama
                                  ? notification.chama.canJoin
                                  : false,
                                (notification as any).requestUserAddress
                              );
                            }}
                            className={`flex items-center px-3 py-1.5 bg-downy-600 text-white rounded-lg transition-colors ${loadingStates[notification.requestId ?? 0] ===
                              "approving"
                              ? "opacity-70 cursor-wait"
                              : "hover:bg-downy-700"
                              }`}
                          >
                            {loadingStates[notification.requestId ?? 0] ===
                              "approving" ? (
                              <span className="flex items-center">
                                <svg
                                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Approving...
                              </span>
                            ) : (
                              <>
                                <FiCheck className="mr-1" size={14} />
                                Approve
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              if (loadingStates[notification.requestId ?? 0])
                                return;
                              handleJoin(
                                "reject",
                                notification.chama
                                  ? Number(notification.chama.blockchainId)
                                  : 0,
                                notification.chamaId ?? 0,
                                notification.chama
                                  ? notification.chama.name
                                  : "",
                                notification.senderId ?? 0,
                                notification.requestId ?? 0,
                                notification.chama
                                  ? notification.chama.canJoin
                                  : false,
                                (notification as any).requestUserAddress
                              );
                            }}
                            className={`flex items-center px-3 py-1.5 bg-red-100 text-red-600 rounded-lg transition-colors ${loadingStates[notification.requestId ?? 0] ===
                              "rejecting"
                              ? "opacity-70 cursor-wait"
                              : "hover:bg-red-200"
                              }`}
                          >
                            {loadingStates[notification.requestId ?? 0] ===
                              "rejecting" ? (
                              <span className="flex items-center">
                                <svg
                                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Rejecting...
                              </span>
                            ) : (
                              <>
                                <FiX className="mr-1" size={14} />
                                Reject
                              </>
                            )}
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
