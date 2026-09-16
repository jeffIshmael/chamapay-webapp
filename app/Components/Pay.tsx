"use client";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import MPesaPay from "./MPesaPay";
import USDCPay from "./USDCPay";
import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { getFundsDisbursedEventLogs } from "@/lib/readFunctions";

const Pay = ({
  openModal,
  closeModal,
  chamaId,
  chamaName,
  chamaBlockchainId,
}: {
  openModal: boolean;
  closeModal: () => void;
  chamaId: number;
  chamaName: string;
  chamaBlockchainId: number;
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("usdc");
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Handle closing animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeModal();
      setIsClosing(false);
      setSelectedPaymentMethod("");
    }, 300);
  };

  // Close modal when clicking on backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (openModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [openModal]);

  return (
    <AnimatePresence>
      {openModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleBackdropClick}
          className={`fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-end ${isLoading ? "pointer-events-none" : ""
            }`}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: isClosing ? "100%" : 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-sm rounded-t-3xl shadow-xl relative"
          >
            <button
              onClick={handleClose}
              disabled={isLoading}
              className={`absolute top-4 right-4 p-1 rounded-full bg-transparent hover:bg-gray-200 transition-colors ${isLoading
                ? "cursor-not-allowed opacity-50 hover:bg-transparent"
                : ""
                }`}
            >
              <FiX className="w-6 h-6 text-gray-600 " />
            </button>

            <div className="p-6">
              <h1 className="text-xl font-bold text-center mb-4">
                Pay to {chamaName}
              </h1>

              <div className="relative">

                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedPaymentMethod}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {selectedPaymentMethod === "mpesa" && (
                      <MPesaPay chamaName={chamaName} />
                    )}
                    {selectedPaymentMethod === "usdc" && (
                      <USDCPay
                        chamaId={chamaId}
                        chamaBlockchainId={chamaBlockchainId}
                        name={chamaName}
                        onClose={handleClose}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Pay;
