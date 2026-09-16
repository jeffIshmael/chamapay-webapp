"use client";

import React, { useState } from "react";
import { checkChama } from "@/lib/chama";
import { useRouter } from "next/navigation";
import { FiAlertTriangle } from "react-icons/fi";
import { showToast } from "../Components/Toast";
import { registerChamaToDatabase } from "@/lib/chamaService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";

const CreateFamily = () => {
  const [groupName, setGroupName] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [startDateDate, setStartDateDate] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const router = useRouter();
  const { token } = useAuth();
  const { isAuthenticated } = useSessionAddress();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setErrorText("");

    if (!isAuthenticated || !token) {
      showToast("Please sign in to create a chama", "warning");
      setIsPending(false);
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const amountNum = parseFloat(data.amount as string);
    const startDate = `${startDateDate}T${startDateTime}`;

    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorText("Amount must be greater than 0");
      setIsPending(false);
      return;
    }
    if (isNaN(Number(data.cycleTime)) || Number(data.cycleTime) <= 0) {
      setErrorText("Cycle time must be greater than 0");
      setIsPending(false);
      return;
    }
    if (!data.name || (data.name as string).length < 3) {
      setErrorText("Name must be at least 3 characters long");
      setIsPending(false);
      return;
    }
    if (new Date(startDate) < new Date()) {
      setErrorText("Start date must be in the future");
      setIsPending(false);
      return;
    }

    try {
      const exists = await checkChama(data.name as string);
      if (exists) {
        setErrorText("Chama with this name already exists");
        return;
      }

      const chamaData = {
        name: data.name as string,
        description: "",
        type: "Private",
        adminTerms: "[]",
        amount: data.amount as string,
        cycleTime: Number(data.cycleTime),
        maxNo: 0,
        startDate: new Date(startDate),
        collateralRequired: false,
      };

      const result = await registerChamaToDatabase(chamaData, token);
      if (!result.success) {
        setErrorText(result.error || "Failed to create chama");
        return;
      }
      showToast(`${data.name} created successfully.`, "success");
      router.push("/MyChamas?tab=chamas");
    } catch (error) {
      setErrorText("A problem occured, try again.");
      console.log(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="relative w-full mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white p-6 rounded-3xl shadow-md w-full mt-3 transform origin-top animate-fadeIn"
      >
        {errorText && (
          <div className="text-red-500 p-2 flex items-center border border-red-500 rounded-md relative mb-2">
            <FiAlertTriangle className="text-red-500 text-sm mr-2" />
            <span className="block sm:inline text-sm">{errorText}</span>
          </div>
        )}
        <div className=" flex flex-column-2 space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-downy-400"
          >
            <path
              fillRule="evenodd"
              d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"
              clipRule="evenodd"
            />
            <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
          </svg>

          <input
            type="text"
            id="groupName"
            name="name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
            placeholder="Enter Group Name"
            className="mt-1 block w-full rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm"
          />
        </div>
        <div className="relative">
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700"
          >
            Amount (USDC)
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contribution Amount"
              required
              className="block w-full rounded-xl border-downy-200 pr-20 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm h-12"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <span className="text-xs font-bold text-downy-600 bg-downy-50 px-2 py-1 rounded-md">
                Min 0.01
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700"
            >
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={startDateDate}
              onChange={(e) => setStartDateDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
              className="mt-1 block w-full text-gray-900 bg-white rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm h-10 [color-scheme:light]"
            />
          </div>

          <div>
            <label
              htmlFor="startTime"
              className="block text-sm font-medium text-gray-700"
            >
              Time
            </label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              required
              className="mt-1 block w-full text-gray-900 bg-white rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm h-10 [color-scheme:light]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="duration"
            className="block text-sm font-medium text-gray-700"
          >
            Cycle Time (in days) (min 1 day)
          </label>
          <input
            type="number"
            id="duration"
            name="cycleTime"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Enter Cycle Time"
            required
            className="mt-1 block w-full rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className={`  font-semibold py-2 px-4 rounded-md ${
              isPending
                ? "bg-gray-300 text-gray-400 hover:bg-gray-300 cursor-not-allowed"
                : "bg-downy-500  hover:bg-downy-600 text-white"
            }`}
          >
            {isPending ? "Creating..." : "Create Chama"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateFamily;
