"use client";
import React, { useState } from "react";
import BottomNavbar from "../Components/BottomNavbar";
import Wallet from "../Components/Wallet";

const Page = () => {
  const [activeSection, setActiveSection] = useState("Wallet");

  return (
    <div>
      <Wallet />
      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
};

export default Page;
