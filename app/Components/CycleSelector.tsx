"use client";

import React from "react";
import { FiCheck } from "react-icons/fi";

export type CycleMode = "days" | "monthly-date";

export interface CycleValue {
  mode: CycleMode;
  /** Cycle length in days (kept as "30" when mode is "monthly-date"). */
  days: string;
  /** Day of month (1-28) used when mode is "monthly-date". */
  day: number | null;
}

/** 1-28 only, so every month has the chosen day. */
export const MONTHLY_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export const ordinal = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD (not UTC, so the date never shifts by timezone). */
export const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Next future occurrence of `day` of the month at `time` (HH:mm). */
export const nextMonthlyOccurrence = (day: number, time = "00:00") => {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  const now = new Date();
  let candidate = new Date(now.getFullYear(), now.getMonth(), day, h || 0, m || 0);
  if (candidate <= now) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, day, h || 0, m || 0);
  }
  return candidate;
};

const ROW_ONE = [
  { days: "1", label: "Daily" },
  { days: "7", label: "Weekly" },
  { days: "14", label: "Biweekly" },
];

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-[13px] outline-none focus:border-downy-500";

interface Props {
  value: CycleValue;
  onChange: (next: CycleValue) => void;
}

export default function CycleSelector({ value, onChange }: Props) {
  const isDate = value.mode === "monthly-date";

  const tagClass = (active: boolean) =>
    `relative py-2.5 rounded-xl border ${
      active ? "bg-downy-50 border-downy-400" : "bg-white border-gray-200"
    }`;

  const check = (
    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-downy-600 text-white flex items-center justify-center">
      <FiCheck className="text-[10px]" strokeWidth={3} />
    </span>
  );

  const preset = (days: string, label: string, className = "") => {
    const active = !isDate && value.days === days;
    return (
      <button
        key={days}
        type="button"
        onClick={() => onChange({ ...value, mode: "days", days })}
        className={`${tagClass(active)} ${className}`}
      >
        {active && check}
        <span
          className={`block text-xs font-bold ${
            active ? "text-downy-800" : "text-gray-700"
          }`}
        >
          {label}
        </span>
        <span
          className={`block text-[10px] mt-0.5 ${
            active ? "text-downy-600" : "text-gray-400"
          }`}
        >
          {days} {days === "1" ? "day" : "days"}
        </span>
      </button>
    );
  };

  return (
    <div>
      {/* Row 1: Daily / Weekly / Biweekly */}
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {ROW_ONE.map((o) => preset(o.days, o.label))}
      </div>

      {/* Row 2: Monthly (1 col) + Specific date every month (2 cols) */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {preset("30", "Monthly")}
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "monthly-date", days: "30" })}
          className={`${tagClass(isDate)} col-span-2`}
        >
          {isDate && check}
          <span
            className={`block text-xs font-bold ${
              isDate ? "text-downy-800" : "text-gray-700"
            }`}
          >
            Specific date every month
          </span>
          <span
            className={`block text-[10px] mt-0.5 ${
              isDate ? "text-downy-600" : "text-gray-400"
            }`}
          >
            {isDate && value.day
              ? `The ${ordinal(value.day)} of every month`
              : "e.g. the 15th of every month"}
          </span>
        </button>
      </div>

      {isDate ? (
        <div className="rounded-xl border border-downy-100 bg-downy-50/40 p-2.5">
          <p className="text-[11px] text-gray-600 mb-2">
            Pick the day of the month payouts happen
          </p>
          <div className="grid grid-cols-7 gap-1">
            {MONTHLY_DAYS.map((d) => {
              const active = value.day === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ ...value, mode: "monthly-date", day: d })}
                  className={`h-8 rounded-lg text-[12px] font-semibold border ${
                    active
                      ? "bg-downy-600 border-downy-600 text-white"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Days 1–28 only, so every month has your date.
          </p>
        </div>
      ) : (
        <input
          type="number"
          min={1}
          value={value.days}
          onChange={(e) => {
            const t = e.target.value;
            if (t === "" || /^\d+$/.test(t)) onChange({ ...value, mode: "days", days: t });
          }}
          placeholder="Or enter custom days"
          className={inputClass}
        />
      )}
    </div>
  );
}