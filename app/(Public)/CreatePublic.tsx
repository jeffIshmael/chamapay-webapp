"use client";

import React, { useState } from "react";
import { checkChama } from "@/lib/chama";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiGlobe, FiShield } from "react-icons/fi";
import { showToast } from "../Components/Toast";
import { registerChamaToDatabase } from "@/lib/chamaService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";

interface Form {
  amount: string;
  cycleTime: string;
  maxNumber: string;
  name: string;
  startDate: string;
}

const CreatePublic = () => {
  const [groupName, setGroupName] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [startDate, setStartDate] = useState("");
  const [maxPeople, setMaxPeople] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [startDateDate, setStartDateDate] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const router = useRouter();
  const { token } = useAuth();
  const { isAuthenticated } = useSessionAddress();
  const [filledData, setFilledData] = useState<Form>({
    amount: "",
    cycleTime: "",
    maxNumber: "",
    name: "",
    startDate: "",
  });

  const openModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const startingDate = `${startDateDate}T${startDateTime}`;
    setStartDate(startingDate);

    if (isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
      setErrorText("Amount must be greater than 0");
      return;
    }
    if (isNaN(Number(data.maxNumber)) || Number(data.maxNumber) <= 1) {
      setErrorText("Max number must be greater than 1");
      return;
    }
    if (isNaN(Number(data.maxNumber)) || Number(data.maxNumber) > 15) {
      setErrorText("Max number of members is 15");
      return;
    }
    if (isNaN(Number(data.cycleTime)) || Number(data.cycleTime) <= 0) {
      setErrorText("Cycle time must be greater than 0");
      return;
    }
    if (!data.name || (data.name as string).length < 3) {
      setErrorText("Name must be at least 3 characters long");
      return;
    }
    if (startingDate < new Date().toISOString()) {
      setErrorText("Start date must be in the future");
      return;
    }

    try {
      setOpeningModal(true);
      const exists = await checkChama(data.name as string);
      if (exists) {
        setErrorText("chama with the name already exists");
        return;
      }
      setFilledData({
        ...(data as unknown as Form),
        startDate: startingDate,
      });
      setShowModal(true);
    } catch (error) {
      console.log(error);
    } finally {
      setOpeningModal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!isAuthenticated || !token) {
      showToast("Please sign in to create a chama", "warning");
      return;
    }

    try {
      setLoading(true);
      const chamaData = {
        name: filledData.name,
        description: "",
        type: "Public",
        adminTerms: "[]",
        amount: filledData.amount,
        cycleTime: Number(filledData.cycleTime),
        maxNo: Number(filledData.maxNumber),
        startDate: new Date(startDate || filledData.startDate),
        collateralRequired: true,
      };

      const result = await registerChamaToDatabase(chamaData, token);
      if (!result.success) {
        setErrorText(result.error || "Failed to create chama");
        return;
      }

      showToast(`${filledData.name} created successfully.`, "success");
      setShowModal(false);
      router.push("/MyChamas");
    } catch (error) {
      showToast("Oops!!something happened.", "error");
      setErrorText("Oops!!something happened.");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full mx-auto">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-[90%] max-w-sm border border-gray-100 animate-fadeInScale">
            {errorText && (
              <div className="text-red-500 p-3 flex items-center bg-red-50 border border-red-200 rounded-xl relative mb-4">
                <FiAlertTriangle className="text-red-500 text-lg mr-2 flex-shrink-0" />
                <span className="block sm:inline text-sm font-medium">
                  {errorText}
                </span>
              </div>
            )}
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-downy-100 p-2 rounded-lg">
                <FiShield className="text-downy-600 text-xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">
                Security Lock
              </h2>
            </div>
            <div className="space-y-4 mb-4">
              <p className="text-gray-600 leading-relaxed">
                You are about to lock{" "}
                <span className="font-bold text-gray-900">
                  {parseFloat(amount) * Number(filledData.maxNumber)} USDC
                </span>{" "}
                to create the{" "}
                <span className="font-bold text-downy-600">
                  {filledData.name}
                </span>{" "}
                chama.
              </p>
              <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <span className="font-bold">Why lock funds?</span> This locked
                  amount acts as security in case any member defaults, ensuring
                  the cycle runs smoothly and everyone gets their payout on
                  time.
                </p>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.98] ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-downy-500 hover:bg-downy-600 hover:shadow-downy-200"
                }`}
              >
                {loading ? "Creating Chama..." : "Confirm & Lock USDC"}
              </button>
              <button
                onClick={loading ? undefined : () => setShowModal(false)}
                disabled={loading}
                className="w-full py-3 text-gray-500 bg-gray-200 rounded-xl font-medium hover:text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute w-0 h-0 border-b-[16px] border-b-transparent  border-r-[34px] border-r-white border-t-[20px] border-t-transparent left-[74%] transform -translate-x-1/2 -translate-y-[45%]"></div>

      <form
        onSubmit={openModal}
        className="space-y-4 bg-white p-6 rounded-3xl shadow-md w-full mt-3 transform origin-top animate-fadeIn"
      >
        {errorText && !showModal && (
          <div
            className="text-red-500 p-2 flex items-center border border-red-500 rounded-md relative mb-2"
            role="alert"
          >
            <FiAlertTriangle className="text-red-500 text-sm mr-2" />
            <span className="block sm:inline text-sm">{errorText}</span>
          </div>
        )}
        <div className=" flex flex-column-2 items-center space-x-2">
          <FiGlobe className="text-downy-500 text-3xl" />

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

        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700"
          >
            Max No. of people(2 - 15 pple)
          </label>
          <input
            type="number"
            id="maxPeople"
            name="maxNumber"
            value={maxPeople}
            min={2}
            step={1}
            max={15}
            onChange={(e) => setMaxPeople(e.target.value)}
            required
            placeholder="Enter Max No. of people"
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
              type="number"
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Contribution Amount"
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
            Cycle Time (in days) (min 1)
          </label>
          <input
            type="number"
            id="duration"
            name="cycleTime"
            value={duration}
            min={1}
            step={1}
            onChange={(e) => setDuration(e.target.value)}
            required
            placeholder="Enter Cycle Time (in days)"
            className="mt-1 block w-full rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={openingModal}
            className={`flex items-center justify-center font-semibold py-2 px-4 rounded-md ${
              openingModal
                ? "bg-gray-300 text-gray-400 hover:bg-gray-300 cursor-not-allowed"
                : "bg-downy-500 hover:bg-downy-600 text-white"
            }`}
          >
            {openingModal ? "..." : "Create Chama"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePublic;
