export type WindowInfo = {
	id: string;
	title: string;
	application: string;
	is_minimized: boolean;
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	thumbnail?: string;
}

export type PermissionStatus = {
	granted: boolean;
	can_request: boolean;
	system_settings_required: boolean;
	message: string;
}
