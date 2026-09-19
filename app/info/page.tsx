"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

type Section = {
  title: string;
  body?: string;
  bullets?: string[];
  footer?: string;
};

type PageData = {
  title: string;
  lastUpdated: string;
  sections: Section[];
};

const PAGES: Record<string, PageData> = {
  about: {
    title: "About Chamapay",
    lastUpdated: "August 2026",
    sections: [
      {
        title: "Saving together, made simple",
        body: "Chamapay is a mobile app that helps friends, families and communities manage their chamas from anywhere.\n\nInstead of manually collecting contributions, tracking payments and remembering whose turn is next, Chamapay automates the process while keeping the experience familiar.\n\nMembers can:",
        bullets: [
          "Create or join trusted savings groups",
          "Deposit and withdraw using M-Pesa",
          "Receive automatic payouts based on the group's schedule",
          "Save idle funds and earn variable yield through Save & Earn",
        ],
        footer:
          "Whether you're saving with family, friends or colleagues, Chamapay makes managing a chama easier, more transparent and more convenient.",
      },
      {
        title: "Our mission",
        body: "We're bringing Africa's tradition of saving together into the digital age.\n\nTechnology should remove the paperwork, not the trust.",
      },
      {
        title: "Contact",
        body: "Website\nwww.chamapay.xyz\n\nSupport\nsupport@chamapay.xyz",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "August 2026",
    sections: [
      {
        title: "Information we collect",
        body: "When you use Chamapay we may collect:",
        bullets: [
          "Name",
          "Profile photo",
          "Email address",
          "Username",
          "Wallet address created for your account",
          "Transaction history",
          "Device analytics",
        ],
      },
      {
        title: "How we use your information",
        body: "We use your information to:",
        bullets: [
          "Create and manage your account",
          "Process deposits and withdrawals",
          "Manage chama activities",
          "Improve the app",
          "Respond to support requests",
          "Send important account notifications",
        ],
      },
      {
        title: "Wallets",
        body: "When you create a Chamapay account, a secure CDP wallet is automatically generated for you.\n\nThis wallet is used to facilitate transactions within Chamapay while keeping the blockchain experience simple for everyday users.",
      },
      {
        title: "Analytics",
        body: "We collect anonymous analytics to understand how Chamapay is used and improve reliability and performance.",
      },
      {
        title: "Sharing your information",
        body: "We never sell your personal information.\n\nInformation may only be shared when necessary to:",
        bullets: [
          "Process payments",
          "Provide blockchain infrastructure",
          "Comply with legal obligations",
        ],
      },
      {
        title: "Contact",
        body: "support@chamapay.xyz",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    lastUpdated: "August 2026",
    sections: [
      {
        title: "Using Chamapay",
        body: "Chamapay allows trusted groups to manage savings circles, contribute using M-Pesa, receive automated payouts and access additional savings features available within the app.",
      },
      {
        title: "Your responsibilities",
        body: "You agree to:",
        bullets: [
          "Provide accurate account information.",
          "Keep your account secure.",
          "Use Chamapay only for lawful purposes.",
          "Join and create chamas with people you trust.",
        ],
      },
      {
        title: "Chama payouts",
        body: "Every chama follows the contribution schedule agreed upon when it is created.\n\nIf one or more members fail to contribute before the scheduled payout:",
        bullets: [
          "The payout will not happen.",
          "Contributions for that round are refunded.",
          "The round is repeated.",
        ],
        footer:
          "Chamapay does not guarantee that members will make their contributions and is not responsible for losses resulting from members failing to contribute.",
      },
      {
        title: "Save & Earn",
        body: "Save & Earn lets you supply funds to supported third-party lending pools (such as Moonwell).\n\nImportant:",
        bullets: [
          "You earn interest paid by borrowers. Rates are variable and not guaranteed.",
          "Your money stays yours, but others may borrow from the same pool.",
          "You can withdraw only when the pool has free cash (money not currently borrowed).",
          "If the pool is fully borrowed, withdrawals pause until cash returns; your deposit remains safe and keeps earning.",
        ],
      },
      {
        title: "Availability",
        body: "We strive to keep Chamapay available at all times.\n\nOccasionally maintenance, upgrades or third-party services may temporarily affect availability.",
      },
      {
        title: "Changes",
        body: "These Terms may change over time.\n\nContinued use of Chamapay means you accept the latest version.",
      },
      {
        title: "Contact",
        body: "support@chamapay.xyz",
      },
    ],
  },
};

function InfoCard({
  title,
  body,
  bullets,
  footer,
  index,
}: Section & { index: number }) {
  return (
    <div className="mb-4 bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="flex">
        <div className="w-1 bg-downy-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-7 h-7 rounded-full bg-downy-100 text-downy-700 text-[11px] font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          </div>

          {body ? (
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line mb-2">
              {body}
            </p>
          ) : null}

          {bullets && bullets.length > 0 ? (
            <ul className="mt-1 mb-1 space-y-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-downy-500 mt-1.5 shrink-0" />
                  <span className="text-[13px] text-gray-700 leading-relaxed">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {footer ? (
            <p className="text-[13px] text-gray-800 leading-relaxed mt-2 font-medium whitespace-pre-line">
              {footer}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoPageContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "about";
  const from = searchParams.get("from");
  const backHref =
    from === "auth" ? "/" : from === "settings" || !from ? "/Settings" : "/Settings";

  const pageData = useMemo(
    () =>
      PAGES[type] || {
        title: "Information",
        lastUpdated: "August 2026",
        sections: [],
      },
    [type]
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      <div
        className="shrink-0 px-4 pt-2 pb-3.5 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center gap-3 min-h-[32px]">
          <Link
            href={backHref}
            replace
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
            aria-label="Go back"
          >
            <FiArrowLeft size={16} />
          </Link>
          <div className="flex-1 text-center pr-8">
            <h1 className="text-[15px] font-bold">{pageData.title}</h1>
            <p className="text-[10px] text-white/70 mt-0.5 font-medium">
              Last updated {pageData.lastUpdated}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 [-webkit-overflow-scrolling:touch]">
        {pageData.sections.length === 0 ? (
          <p className="text-center text-[13px] text-gray-500 py-10">
            Content not found.
          </p>
        ) : (
          pageData.sections.map((section, idx) => (
            <InfoCard key={section.title} index={idx} {...section} />
          ))
        )}
      </div>
    </div>
  );
}

export default function InfoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
          <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <InfoPageContent />
    </Suspense>
  );
}
