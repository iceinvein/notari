export type ApplicationPreference = {
	name: string; // Display name
	enabled: boolean;
	addedAt: string;
	isDefault?: boolean;
	aliases?: string[]; // Alternative names this app might be detected as
}

export type UserPreferences = {
	allowedApplications: ApplicationPreference[];
	version: number;
	lastUpdated: string;
}

export const DEFAULT_APPLICATIONS: ApplicationPreference[] = [
	{
		name: "Google Chrome",
		enabled: true,
		addedAt: new Date().toISOString(),
		isDefault: true,
	},
	{
		name: "Visual Studio Code",
		enabled: true,
		addedAt: new Date().toISOString(),
		isDefault: true,
		aliases: ["Code"], // VS Code can be detected as "Code" in some contexts
	},
];

export const COMMON_APPLICATIONS = [
	// Browsers
	"Safari",
	"Google Chrome",
	"Firefox",
	"Brave Browser",
	"Microsoft Edge",
	"Arc",

	// Code Editors
	"Visual Studio Code",
	"Xcode",
	"Sublime Text",
	"Atom",
	"WebStorm",
	"IntelliJ IDEA",

	// Communication
	"Slack",
	"Discord",
	"Microsoft Teams",
	"Zoom",
	"Skype",

	// Design Tools
	"Figma",
	"Sketch",
	"Adobe Photoshop",
	"Adobe Illustrator",
	"Adobe XD",

	// Productivity
	"Microsoft Word",
	"Microsoft Excel",
	"Microsoft PowerPoint",
	"Pages",
	"Numbers",
	"Keynote",
	"Notion",
	"Obsidian",
	"Evernote",

	// Terminal
	"Terminal",
	"iTerm2",
	"Warp",
	"Hyper",

	// Media
	"VLC",
	"QuickTime Player",
	"IINA",

	// System
	"Finder",
	"Preview",
	"Calculator",
];

/**
 * Find an application preference by name or alias
 */
export function findApplicationByNameOrAlias(
	applications: ApplicationPreference[],
	searchName: string
): ApplicationPreference | undefined {
	return applications.find((app) => app.name === searchName || app.aliases?.includes(searchName));
}

/**
 * Check if an application is allowed by name or alias
 */
export function isApplicationAllowedByNameOrAlias(
	applications: ApplicationPreference[],
	searchName: string
): boolean {
	const app = findApplicationByNameOrAlias(applications, searchName);
	return app?.enabled ?? false;
}

/**
 * Get the canonical (display) name for an application, resolving aliases
 */
export function getCanonicalApplicationName(
	applications: ApplicationPreference[],
	searchName: string
): string {
	const app = findApplicationByNameOrAlias(applications, searchName);
	return app?.name ?? searchName;
}

/**
 * Migrate old preferences to remove duplicate applications and consolidate aliases
 */
export function migrateApplicationPreferences(
	applications: ApplicationPreference[]
): ApplicationPreference[] {
	const migrated: ApplicationPreference[] = [];
	const processedNames = new Set<string>();

	// Define known aliases that should be consolidated
	const aliasMap: Record<string, { name: string; aliases: string[] }> = {
		"Visual Studio Code": { name: "Visual Studio Code", aliases: ["Code"] },
		Code: { name: "Visual Studio Code", aliases: ["Code"] },
	};

	for (const app of applications) {
		// Check if this app should be consolidated
		const consolidation = aliasMap[app.name];

		if (consolidation) {
			const canonicalName = consolidation.name;

			// Skip if we've already processed the canonical version
			if (processedNames.has(canonicalName)) {
				continue;
			}

			// Find all apps that should be consolidated into this one
			const relatedApps = applications.filter(
				(a) => a.name === canonicalName || consolidation.aliases.includes(a.name)
			);

			// Create consolidated app - enabled if any related app is enabled
			const isEnabled = relatedApps.some((a) => a.enabled);
			const isDefault = relatedApps.some((a) => a.isDefault);
			const earliestDate = relatedApps.map((a) => a.addedAt).sort()[0];

			migrated.push({
				name: canonicalName,
				enabled: isEnabled,
				addedAt: earliestDate,
				isDefault,
				aliases: consolidation.aliases,
			});

			processedNames.add(canonicalName);
		} else {
			// App doesn't need consolidation, add as-is
			if (!processedNames.has(app.name)) {
				migrated.push(app);
				processedNames.add(app.name);
			}
		}
	}

	return migrated;
}
