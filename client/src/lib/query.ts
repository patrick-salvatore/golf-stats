import { QueryClient } from "@tanstack/solid-query";

// Create QueryClient with offline-friendly defaults
// Note: We're using idb-keyval for manual persistence in storage.ts
// The TanStack Query cache handles in-memory caching while the app is running
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      retry: 1,
    },
  },
});