import { addToast } from "@heroui/toast";

// Custom hook to use toast notifications with convenient methods
// Bottom-positioned, full-width with margin
export function useToast() {
	return {
		success: (title: string, description?: string) => {
			addToast({
				title,
				description,
				color: "success",
				variant: "flat",
				timeout: 4000,
				hideCloseButton: true,
			});
		},
		error: (title: string, description?: string) => {
			addToast({
				title,
				description,
				color: "danger",
				variant: "flat",
				timeout: 6000,
				hideCloseButton: true,
			});
		},
		warning: (title: string, description?: string) => {
			addToast({
				title,
				description,
				color: "warning",
				variant: "flat",
				timeout: 5000,
				hideCloseButton: true,
			});
		},
		info: (title: string, description?: string) => {
			addToast({
				title,
				description,
				color: "primary",
				variant: "flat",
				timeout: 4000,
				hideCloseButton: true,
			});
		},
		// For custom toasts with full control
		custom: addToast,
	};
}
