import { QueryClient } from "@tanstack/react-query";

// Create a client with sensible defaults for a Tauri app
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Tauri calls are fast, so we can be more aggressive with stale time
			staleTime: 1000 * 60 * 5, // 5 minutes
			// Cache data for longer since Tauri backend is local
			gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime in v4)
			// Retry failed requests, but not too aggressively for local calls
			retry: (failureCount, error) => {
				// Don't retry if it's a permission or validation error
				const errorMessage = String(error);
				if (
					errorMessage.includes("permission") ||
					errorMessage.includes("not found") ||
					errorMessage.includes("invalid")
				) {
					return false;
				}
				// Retry up to 2 times for other errors
				return failureCount < 2;
			},
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		},
		mutations: {
			// Retry mutations once in case of transient failures
			retry: 1,
		},
	},
});
