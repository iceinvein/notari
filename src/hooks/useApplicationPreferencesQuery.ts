import { useMemo } from "react";
import {
	useAddApplicationMutation,
	usePreferencesHelpers,
	usePreferencesQuery,
	useRemoveApplicationMutation,
	useResetToDefaultsMutation,
	useToggleApplicationMutation,
} from "../lib/preferences-queries";

export const useApplicationPreferencesQuery = () => {
	const { data: preferences, isLoading: loading, error } = usePreferencesQuery();
	const addApplicationMutation = useAddApplicationMutation();
	const removeApplicationMutation = useRemoveApplicationMutation();
	const toggleApplicationMutation = useToggleApplicationMutation();
	const resetToDefaultsMutation = useResetToDefaultsMutation();
	const { getEnabledApplications, isApplicationAllowed } = usePreferencesHelpers();

	return useMemo(() => ({
		preferences,
		loading,
		error: error ? String(error) : null,

		// Mutations
		addApplication: addApplicationMutation.mutateAsync,
		removeApplication: removeApplicationMutation.mutateAsync,
		toggleApplication: toggleApplicationMutation.mutateAsync,
		resetToDefaults: resetToDefaultsMutation.mutateAsync,

		// Helper functions
		getEnabledApplications,
		isApplicationAllowed,

		// Mutation states for UI feedback
		isAddingApplication: addApplicationMutation.isPending,
		isRemovingApplication: removeApplicationMutation.isPending,
		isTogglingApplication: toggleApplicationMutation.isPending,
		isResettingToDefaults: resetToDefaultsMutation.isPending,

		// For backward compatibility, provide a reload function
		reload: () => {
			// React Query handles this automatically, but we can force a refetch if needed
			// This is mainly for backward compatibility
		},
	}), [
		preferences,
		loading,
		error,
		addApplicationMutation.mutateAsync,
		addApplicationMutation.isPending,
		removeApplicationMutation.mutateAsync,
		removeApplicationMutation.isPending,
		toggleApplicationMutation.mutateAsync,
		toggleApplicationMutation.isPending,
		resetToDefaultsMutation.mutateAsync,
		resetToDefaultsMutation.isPending,
		getEnabledApplications,
		isApplicationAllowed,
	]);
};
