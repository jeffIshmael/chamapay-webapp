// Server URL configuration
// Set EXPO_PUBLIC_SERVER_URL in your .env file or environment
// For production, use your Render server URL
// For development, you can use ngrok or localhost

const getServerUrl = (): string => {
  // Check both NEXT_PUBLIC and EXPO_PUBLIC prefixes
  const envUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.EXPO_PUBLIC_SERVER_URL;

  if (envUrl) {
    return envUrl;
  }

  // Fallback to onrender for development or if env var is missing during build
  // This prevents the build from crashing during static generation
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production") {
    return "https://chamapay-app.onrender.com";
  }

  return "https://chamapay-app.onrender.com";
};

export const serverUrl = getServerUrl();