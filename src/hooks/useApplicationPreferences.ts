import { Store } from "@tauri-apps/plugin-store";
import { useCallback, useEffect, useState } from "react";

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

export const useApplicationPreferences = () => {
	const [preferences, setPreferences] = useState<UserPreferences | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [store, setStore] = useState<Store | null>(null);

	// Load preferences from storage
	const loadPreferences = useCallback(async () => {
		try {
			preferencesLogger.info("Loading preferences from storage");
			setLoading(true);
			setError(null);

			// Initialize store if not already done
			let storeInstance = store;
			if (!storeInstance) {
				storeLogger.info("Initializing store");
				storeInstance = await Store.load("preferences.json");
				setStore(storeInstance);
				storeLogger.info("Store initialized successfully");
			}

			const stored = await storeInstance.get<UserPreferences>(PREFERENCES_KEY);

			if (stored && stored.version === PREFERENCES_VERSION) {
				preferencesLogger.info("Found existing preferences", {
					version: stored.version,
					appCount: stored.allowedApplications.length,
				});
				setPreferences(stored);
			} else {
				preferencesLogger.info("No existing preferences found, creating defaults");

				// Create default preferences
				const defaultPrefs: UserPreferences = {
					allowedApplications: DEFAULT_APPLICATIONS,
					version: PREFERENCES_VERSION,
					lastUpdated: new Date().toISOString(),
				};

				await storeInstance.set(PREFERENCES_KEY, defaultPrefs);
				await storeInstance.save();
				setPreferences(defaultPrefs);
				preferencesLogger.info("Default preferences created successfully");
			}
		} catch (err) {
			const errorMsg = `Failed to load preferences: ${err}`;
			setError(errorMsg);
			preferencesLogger.error(
				"Failed to load preferences",
				err instanceof Error ? err : new Error(String(err))
			);
		} finally {
			setLoading(false);
		}
	}, [store]);

	// Save preferences to storage
	const savePreferences = useCallback(
		async (newPreferences: UserPreferences) => {
			try {
				preferencesLogger.debug("Saving preferences", {
					appCount: newPreferences.allowedApplications.length,
				});
				setError(null);

				// Ensure store is initialized
				if (!store) {
					const error = "Store not initialized";
					setError(error);
					storeLogger.error(error);
					return;
				}

				const updatedPrefs = {
					...newPreferences,
					lastUpdated: new Date().toISOString(),
				};

				await store.set(PREFERENCES_KEY, updatedPrefs);
				await store.save();
				setPreferences(updatedPrefs);
				preferencesLogger.info("Preferences saved successfully");
			} catch (err) {
				const errorMsg = `Failed to save preferences: ${err}`;
				setError(errorMsg);
				preferencesLogger.error(
					"Failed to save preferences",
					err instanceof Error ? err : new Error(String(err))
				);
			}
		},
		[store]
	);

	// Add application to allowed list
	const addApplication = useCallback(
		async (applicationName: string) => {
			if (!preferences) return;

			// Check if app already exists by name or alias
			const existingApp = findApplicationByNameOrAlias(
				preferences.allowedApplications,
				applicationName
			);

			if (existingApp) {
				// Enable if it exists but is disabled
				if (!existingApp.enabled) {
					const updatedApps = preferences.allowedApplications.map((app) =>
						app === existingApp ? { ...app, enabled: true } : app
					);

					await savePreferences({
						...preferences,
						allowedApplications: updatedApps,
					});
				}
				return;
			}

			// Add new application
			const newApp: ApplicationPreference = {
				name: applicationName,
				enabled: true,
				addedAt: new Date().toISOString(),
				isDefault: false,
			};

			const updatedApps = [...preferences.allowedApplications, newApp];
			await savePreferences({
				...preferences,
				allowedApplications: updatedApps,
			});
		},
		[preferences, savePreferences]
	);

	// Remove application from allowed list
	const removeApplication = useCallback(
		async (applicationName: string) => {
			if (!preferences) return;

			// Find app by name or alias
			const app = findApplicationByNameOrAlias(preferences.allowedApplications, applicationName);

			if (!app) return;

			if (app.isDefault) {
				// Don't remove default apps, just disable them
				const updatedApps = preferences.allowedApplications.map((a) =>
					a === app ? { ...a, enabled: false } : a
				);

				await savePreferences({
					...preferences,
					allowedApplications: updatedApps,
				});
			} else {
				// Remove non-default apps completely
				const updatedApps = preferences.allowedApplications.filter((a) => a !== app);

				await savePreferences({
					...preferences,
					allowedApplications: updatedApps,
				});
			}
		},
		[preferences, savePreferences]
	);

	// Toggle application enabled state
	const toggleApplication = useCallback(
		async (applicationName: string) => {
			if (!preferences) return;

			// Find app by name or alias
			const targetApp = findApplicationByNameOrAlias(
				preferences.allowedApplications,
				applicationName
			);

			if (!targetApp) return;

			const updatedApps = preferences.allowedApplications.map((app) =>
				app === targetApp ? { ...app, enabled: !app.enabled } : app
			);

			await savePreferences({
				...preferences,
				allowedApplications: updatedApps,
			});
		},
		[preferences, savePreferences]
	);

	// Get enabled applications
	const getEnabledApplications = useCallback(() => {
		if (!preferences) return [];
		return preferences.allowedApplications.filter((app) => app.enabled).map((app) => app.name);
	}, [preferences]);

	// Check if application is allowed
	const isApplicationAllowed = useCallback(
		(applicationName: string) => {
			if (!preferences) return false;
			return isApplicationAllowedByNameOrAlias(preferences.allowedApplications, applicationName);
		},
		[preferences]
	);

	// Reset to defaults
	const resetToDefaults = useCallback(async () => {
		try {
			preferencesLogger.info("resetToDefaults: Starting reset process");

			// Ensure store is initialized
			if (!store) {
				preferencesLogger.error("resetToDefaults: Store not initialized");
				throw new Error("Store not initialized");
			}

			preferencesLogger.info("resetToDefaults: Store is initialized, creating default preferences");
			const defaultPrefs: UserPreferences = {
				allowedApplications: DEFAULT_APPLICATIONS,
				version: PREFERENCES_VERSION,
				lastUpdated: new Date().toISOString(),
			};

			preferencesLogger.info("resetToDefaults: Calling savePreferences with defaults", {
				appCount: defaultPrefs.allowedApplications.length,
				version: defaultPrefs.version,
			});

			await savePreferences(defaultPrefs);
			preferencesLogger.info("resetToDefaults: Successfully completed reset");
		} catch (error) {
			const errorMsg = `Failed to reset to defaults: ${error}`;
			setError(errorMsg);
			preferencesLogger.error(
				"resetToDefaults: Failed to reset preferences",
				error instanceof Error ? error : new Error(String(error))
			);
			throw error; // Re-throw so the UI can handle it
		}
	}, [store, savePreferences]);

	// Load preferences on mount
	useEffect(() => {
		loadPreferences();
	}, [loadPreferences]);

	return {
		preferences,
		loading,
		error,
		addApplication,
		removeApplication,
		toggleApplication,
		getEnabledApplications,
		isApplicationAllowed,
		resetToDefaults,
		reload: loadPreferences,
	};
};
