// this function receive no. of days and return it in simple form e.g 1 week, 3 wks
export const duration = (cycleTime: number) => {
  const daysInYear = 365;
  const daysInMonth = 30; // Approximate month duration
  const daysInWeek = 7;

  // Calculate time units and their remainders
  const years = Math.floor(cycleTime / daysInYear);
  const months = Math.floor(cycleTime / daysInMonth);
  const weeks = Math.floor(cycleTime / daysInWeek);

  const remainderYears = cycleTime % daysInYear;
  const remainderMonths = cycleTime % daysInMonth;
  const remainderWeeks = cycleTime % daysInWeek;

  let result = "";

  // Display the highest unit if there is no remainder, otherwise display in days
  if (years > 0 && remainderYears === 0) {
    result = years === 1 ? "year" : `${years} yrs`;
  } else if (months > 0 && remainderMonths === 0) {
    result = months === 1 ? "month" : `${months} months`;
  } else if (weeks > 0 && remainderWeeks === 0) {
    result = weeks === 1 ? "week" : `${weeks} wks`;
  } else {
    result = cycleTime === 1 ? "day" : `${cycleTime} dys`;
  }

  return result;
};

function toValidDate(
  value: Date | string | number | null | undefined
): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// this function changes UTC time to user's local time
export const utcToLocalTime = (
  utcDate: Date | string | number | null | undefined
) => {
  const date = toValidDate(utcDate);
  if (!date) return "—";

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: userTimeZone,
  }).format(date);
};

//this function changes time from UTC to EAT
export const utcToEAT = (
  utcDate: Date | string | number | null | undefined
) => {
  const date = toValidDate(utcDate);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
};

// this function will is to loop between the pictures
export const getPicture = (id: number): string => {
  if (id <= 20) {
    return id.toString();
  } else {
    return (id % 20).toString();
  }
};

// Utility function to format time remaining
export const formatTimeRemaining = (
  targetDate: string | Date | null | undefined
): string => {
  const target = toValidDate(targetDate);
  if (!target) return "—";

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  // If date has passed
  if (diffMs < 0) {
    return "Passed";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  // Less than a day - show hours and minutes
  if (diffDays < 1) {
    const hours = diffHours;
    const minutes = diffMinutes % 60;

    if (hours === 0) {
      return `${minutes} min${minutes !== 1 ? "s" : ""}`;
    }
    return `${hours} hr${hours !== 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`;
  }

  // Less than a week - show days
  if (diffDays < 7) {
    return `${diffDays} dy${diffDays !== 1 ? "s" : ""}`;
  }

  // Less than a month - show weeks and days
  if (diffDays < 30) {
    const weeks = diffWeeks;
    const remainingDays = diffDays % 7;

    if (remainingDays === 0) {
      return `${weeks} wk${weeks !== 1 ? "s" : ""}`;
    }
    return `${weeks} wk${weeks !== 1 ? "s" : ""} ${remainingDays} dy${remainingDays !== 1 ? "s" : ""}`;
  }

  // More than a month - show months, weeks, and days
  const months = diffMonths;
  const remainingDaysAfterMonths = diffDays % 30;
  const remainingWeeks = Math.floor(remainingDaysAfterMonths / 7);
  const remainingDays = remainingDaysAfterMonths % 7;

  let result = `${months} mnth${months !== 1 ? "s" : ""}`;

  if (remainingWeeks > 0) {
    result += ` ${remainingWeeks} wk${remainingWeeks !== 1 ? "s" : ""}`;
  }

  if (remainingDays > 0) {
    result += ` ${remainingDays} dy${remainingDays !== 1 ? "s" : ""}`;
  }

  return result;
};

// function that received days and formats it better
export const formatDays = (days: number): string => {
  if (!Number.isFinite(days) || days <= 0) return "";

  // 1 day
  if (days === 1) return "Daily";

  // Weeks
  if (days % 7 === 0 && days < 30) {
    const weeks = days / 7;
    return weeks === 1 ? "Weekly" : `${weeks} weeks`;
  }

  // Months (using 30-day approximation)
  if (days % 30 === 0 && days < 365) {
    const months = days / 30;
    return months === 1 ? "Monthly" : `${months} months`;
  }

  // Years (using 365-day cycle)
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "Yearly" : `${years} years`;
  }

  // Multi-week months — e.g. 45 days = "6 weeks"
  if (days % 7 === 0 && days < 365) {
    const weeks = days / 7;
    return `${weeks} weeks`;
  }

  // Fallback — exact days
  return `${days} days`;
};
