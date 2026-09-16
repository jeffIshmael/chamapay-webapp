import { formatTimeRemaining as formatTimeRemainingUtils } from "../utils/duration";

export const formatTimeRemaining = async (diffMs: number) => {
    // The components expect a promise-based or at least a consistent interface
    // but the actual util is synchronous. I'll wrap it to be safe if needed,
    // though the components seem to await it.

    // Actually, looking at Schedule.tsx, it awaits formatTimeRemaining(diff).
    // So I'll just export it.
    return formatTimeRemainingUtils(new Date(Date.now() + diffMs));
};
