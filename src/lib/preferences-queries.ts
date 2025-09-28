import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store } from "@tauri-apps/plugin-store";
import {
	type ApplicationPreference,
	DEFAULT_APPLICATIONS,
	findApplicationByNameOrAlias,
	isApplicationAllowedByNameOrAlias,
	type UserPreferences,
} from "../types/preferences";
import { preferencesLogger, storeLogger } from "../utils/logger";

const PREFERENCES_KEY = "user_preferences";
const PREFERENCES_VERSION = 1;

// Query key for preferences
export const preferencesQueryKey = ["preferences"] as const;

// Store instance - we'll initialize it once and reuse
let storeInstance: Store | null = null;

const getStore = async (): Promise<Store> => {
	if (!storeInstance) {
		storeLogger.info("Initializing store");
		storeInstance = await Store.load("preferences.json");
		storeLogger.info("Store initialized successfully");
	}
	return storeInstance;
};

// Query hook for loading preferences
export const usePreferencesQuery = () => {
	return useQuery({
		queryKey: preferencesQueryKey,
		queryFn: async (): Promise<UserPreferences> => {
			try {
				preferencesLogger.info("Loading preferences from storage");

				const store = await getStore();
				const stored = await store.get<UserPreferences>(PREFERENCES_KEY);

				if (stored && stored.version === PREFERENCES_VERSION) {
					preferencesLogger.info("Found existing preferences", {
						version: stored.version,
						appCount: stored.allowedApplications.length,
					});
					return stored;
				} else {
					preferencesLogger.info("No existing preferences found, creating defaults");

					// Create default preferences
					const defaultPrefs: UserPreferences = {
						allowedApplications: DEFAULT_APPLICATIONS,
						version: PREFERENCES_VERSION,
						lastUpdated: new Date().toISOString(),
					};

					await store.set(PREFERENCES_KEY, defaultPrefs);
					await store.save();
					preferencesLogger.info("Default preferences created successfully");
					return defaultPrefs;
				}
			} catch (err) {
				preferencesLogger.error(
					"Failed to load preferences",
					err instanceof Error ? err : new Error(String(err))
				);
				throw new Error(`Failed to load preferences: ${err}`);
			}
		},
	});
};

// Mutation hook for saving preferences
export const useSavePreferencesMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (newPreferences: UserPreferences): Promise<UserPreferences> => {
			try {
				preferencesLogger.debug("Saving preferences", {
					appCount: newPreferences.allowedApplications.length,
				});

				const store = await getStore();
				const updatedPrefs = {
					...newPreferences,
					lastUpdated: new Date().toISOString(),
				};

				await store.set(PREFERENCES_KEY, updatedPrefs);
				await store.save();

				preferencesLogger.info("Preferences saved successfully");
				return updatedPrefs;
			} catch (err) {
				preferencesLogger.error(
					"Failed to save preferences",
					err instanceof Error ? err : new Error(String(err))
				);
				throw new Error(`Failed to save preferences: ${err}`);
			}
		},
		onSuccess: (updatedPrefs) => {
			// Update the cache with the new preferences
			queryClient.setQueryData(preferencesQueryKey, updatedPrefs);
			// Also invalidate to ensure all components get the update
			queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
		},
	});
};

// Mutation hook for adding an application
export const useAddApplicationMutation = () => {
	const savePreferences = useSavePreferencesMutation();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (newApp: ApplicationPreference) => {
			const currentPrefs = queryClient.getQueryData<UserPreferences>(preferencesQueryKey);
			if (!currentPrefs) {
				throw new Error("Preferences not loaded");
			}

			// Check if app already exists
			const existingApp = findApplicationByNameOrAlias(
				currentPrefs.allowedApplications,
				newApp.name
			);

			if (existingApp) {
				throw new Error(`Application "${newApp.name}" already exists`);
			}

			const updatedPrefs = {
				...currentPrefs,
				allowedApplications: [...currentPrefs.allowedApplications, newApp],
			};

			return await savePreferences.mutateAsync(updatedPrefs);
		},
		onSuccess: () => {
			// Invalidate preferences cache to ensure all components get the update
			queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
		},
	});
};

// Mutation hook for removing an application
export const useRemoveApplicationMutation = () => {
	const savePreferences = useSavePreferencesMutation();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (applicationName: string) => {
			const currentPrefs = queryClient.getQueryData<UserPreferences>(preferencesQueryKey);
			if (!currentPrefs) {
				throw new Error("Preferences not loaded");
			}

			const updatedApps = currentPrefs.allowedApplications.filter(
				(app) => app.name !== applicationName && !app.aliases?.includes(applicationName)
			);

			const updatedPrefs = {
				...currentPrefs,
				allowedApplications: updatedApps,
			};

			return await savePreferences.mutateAsync(updatedPrefs);
		},
		onSuccess: () => {
			// Invalidate preferences cache to ensure all components get the update
			queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
		},
	});
};

// Mutation hook for toggling an application
export const useToggleApplicationMutation = () => {
	const savePreferences = useSavePreferencesMutation();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (applicationName: string) => {
			const currentPrefs = queryClient.getQueryData<UserPreferences>(preferencesQueryKey);
			if (!currentPrefs) {
				throw new Error("Preferences not loaded");
			}

			// Find app by name or alias
			const targetApp = findApplicationByNameOrAlias(
				currentPrefs.allowedApplications,
				applicationName
			);

			if (!targetApp) {
				throw new Error(`Application "${applicationName}" not found`);
			}

			const updatedApps = currentPrefs.allowedApplications.map((app) =>
				app === targetApp ? { ...app, enabled: !app.enabled } : app
			);

			const updatedPrefs = {
				...currentPrefs,
				allowedApplications: updatedApps,
			};

			return await savePreferences.mutateAsync(updatedPrefs);
		},
		onSuccess: () => {
			// Invalidate preferences cache to ensure all components get the update
			queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
		},
	});
};

// Mutation hook for resetting to defaults
export const useResetToDefaultsMutation = () => {
	const savePreferences = useSavePreferencesMutation();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			preferencesLogger.info("resetToDefaults: Starting reset to default preferences");

			const defaultPrefs: UserPreferences = {
				allowedApplications: DEFAULT_APPLICATIONS,
				version: PREFERENCES_VERSION,
				lastUpdated: new Date().toISOString(),
			};

			const result = await savePreferences.mutateAsync(defaultPrefs);
			preferencesLogger.info("resetToDefaults: Successfully completed reset");
			return result;
		},
		onSuccess: () => {
			// Invalidate preferences cache to ensure all components get the update
			queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
		},
	});
};

// Utility hooks for common operations
export const usePreferencesHelpers = () => {
	const { data: preferences } = usePreferencesQuery();

	return {
		getEnabledApplications: () => {
			return preferences?.allowedApplications.filter((app) => app.enabled) || [];
		},
		isApplicationAllowed: (applicationName: string) => {
			if (!preferences) return false;
			return isApplicationAllowedByNameOrAlias(preferences.allowedApplications, applicationName);
		},
	};
};
