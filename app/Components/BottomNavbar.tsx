"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

export default function BottomNavbar({
  activeSection,
  setActiveSection,
}: {
  activeSection: string;
  setActiveSection: (section: string) => void;
}) {
  const handleClick = (section: string) => {
    setActiveSection(section); // Update parent state
  };

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const controlNavbar = () => {
    if (typeof window !== 'undefined') {
      if (window.scrollY > lastScrollY) {
        // Scroll Down
        setIsVisible(false);
      } else {
        // Scroll Up
        setIsVisible(true);
      }
      setLastScrollY(window.scrollY);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlNavbar);

      return () => {
        window.removeEventListener("scroll", controlNavbar);
      };
    }
  }, [lastScrollY, controlNavbar]);

  return (
    <nav className={`fixed bottom-0 w-full max-w-sm bg-white rounded-xl shadow-md py-1 z-50  ${ isVisible ? 'block' : 'hidden'}
      `}>
      <div className="flex justify-around w-full items-center">
        <Link
          href="/MyChamas"
          onClick={() => handleClick("Home")}
          className={`flex flex-col items-center bg-transparent hover:bg-transparent ${
            activeSection === "Home" || activeSection === "Chamas" ? "text-downy-500" : "text-gray-500"
          } hover:text-black`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M19.006 3.705a.75.75 0 1 0-.512-1.41L6 6.838V3a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 3 3v4.93l-1.006.365a.75.75 0 0 0 .512 1.41l16.5-6Z" />
            <path
              fillRule="evenodd"
              d="M3.019 11.114 18 5.667v3.421l4.006 1.457a.75.75 0 1 1-.512 1.41l-.494-.18v8.475h.75a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1 0-1.5H3v-9.129l.019-.007ZM18 20.25v-9.566l1.5.546v9.02H18Zm-9-6a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H9Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-1">Home</span>
        </Link>

        <Link
          href="/SaveEarn"
          onClick={() => handleClick("SaveEarn")}
          className={`flex flex-col items-center bg-transparent hover:bg-transparent ${
            activeSection === "SaveEarn" ? "text-downy-500" : "text-gray-500"
          } hover:text-black`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M8.25 6.75a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75V6.75ZM12 6a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75h-.01A.75.75 0 0 1 12 6.01V6Zm3.75.75a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75H15a.75.75 0 0 0 .75-.75V6.75a.75.75 0 0 0-.75-.75h-.01ZM8.25 9.75A.75.75 0 0 1 9 9h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75V9.75ZM12 9a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75h-.01A.75.75 0 0 1 12 9.01V9Zm3.75.75a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75H15a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.01ZM9.75 12.75a.75.75 0 0 0-.75.75v7.5a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75h-4.5Z" />
            <path fillRule="evenodd" d="M4.5 3.75A2.25 2.25 0 0 1 6.75 1.5h10.5a2.25 2.25 0 0 1 2.25 2.25v16.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V3.75Zm2.25-.75a.75.75 0 0 0-.75.75v16.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75H6.75Z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] mt-1 text-center leading-tight max-w-[56px]">
            Save &amp; Earn
          </span>
        </Link>

        <Link
          href="/Create"
          onClick={() => handleClick("Create")}
          className="flex flex-col items-center text-gray-500 hover:text-black"
        >
          <div className="rounded-full bg-downy-400 p-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-white"
            >
              <path
                fillRule="evenodd"
                d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className={`text-xs mt-1 ${activeSection === "Create" ? "text-downy-500" : ""}`}>Create</span>
        </Link>

        <Link
          href="/Notifications"
          onClick={() => handleClick("Notifications")}
          className={`flex flex-col items-center bg-transparent hover:bg-transparent ${
            activeSection === "Notifications" ? "text-downy-500" : "text-gray-500"
          } hover:text-black`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-1">Notifications</span>
        </Link>

        <Link
          href="/Wallet"
          onClick={() => handleClick("Wallet")}
          className={`flex flex-col items-center bg-transparent hover:bg-transparent ${
            activeSection === "Wallet" ? "text-downy-500" : "text-gray-500"
          } hover:text-black`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6"
          >
            <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z" />
          </svg>

          <span className="text-xs  mt-1">Wallet</span>
        </Link>
      </div>
    </nav>
  );
}
