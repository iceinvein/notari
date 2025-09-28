import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApplicationPreferencesQuery } from "../hooks/useApplicationPreferencesQuery";
import { COMMON_APPLICATIONS } from "../types/preferences";

type ApplicationSelectorProps = {
	title?: string;
	description?: string;
	showAddCustom?: boolean;
	compact?: boolean;
	onComplete?: () => void;
}

export default function ApplicationSelector({
	title = "Select Applications to Record",
	description = "Choose which applications you want to allow for recording sessions.",
	showAddCustom = true,
	compact = false,
	onComplete,
}: ApplicationSelectorProps) {
	const {
		preferences,
		loading,
		error,
		addApplication,
		removeApplication,
		toggleApplication,
		getEnabledApplications,
	} = useApplicationPreferencesQuery();

	const [searchQuery, setSearchQuery] = useState("");
	const [customAppName, setCustomAppName] = useState("");
	const [showAddCustomInput, setShowAddCustomInput] = useState(false);

	// Filter available applications based on search and what's already added
	const availableApplications = useMemo(() => {
		const currentApps = preferences?.allowedApplications.map((app) => app.name) || [];
		const filtered = COMMON_APPLICATIONS.filter(
			(app) => !currentApps.includes(app) && app.toLowerCase().includes(searchQuery.toLowerCase())
		);
		return filtered;
	}, [preferences, searchQuery]);

	// Current user applications filtered by search
	const userApplications = useMemo(() => {
		if (!preferences) return [];
		return preferences.allowedApplications.filter((app) =>
			app.name.toLowerCase().includes(searchQuery.toLowerCase())
		);
	}, [preferences, searchQuery]);

	const handleAddCustomApp = async () => {
		if (!customAppName.trim()) return;

		const newApp = {
			name: customAppName.trim(),
			enabled: true,
			addedAt: new Date().toISOString(),
			isDefault: false,
		};
		await addApplication(newApp);
		setCustomAppName("");
		setShowAddCustomInput(false);
	};

	const handleAddFromList = async (appName: string) => {
		const newApp = {
			name: appName,
			enabled: true,
			addedAt: new Date().toISOString(),
			isDefault: false,
		};
		await addApplication(newApp);
	};

	const enabledCount = getEnabledApplications().length;

	if (loading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-center space-y-4">
					<Spinner size="lg" color="primary" />
					<p className="text-foreground-500">Loading preferences...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 text-center">
				<p className="text-danger text-sm">{error}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			{!compact && (
				<div className="text-center space-y-2">
					<h3 className="text-lg font-semibold text-foreground">{title}</h3>
					<p className="text-sm text-foreground-500">{description}</p>
					<Chip size="sm" color="primary" variant="flat">
						{enabledCount} application{enabledCount !== 1 ? "s" : ""} enabled
					</Chip>
				</div>
			)}

			{/* Search */}
			<Input
				placeholder="Search applications..."
				value={searchQuery}
				onValueChange={setSearchQuery}
				startContent={<Search className="w-4 h-4 text-foreground-400" />}
				size="sm"
				classNames={{
					input: "text-sm",
				}}
			/>

			{/* Current Applications */}
			{userApplications.length > 0 && (
				<Card className="bg-content1">
					<CardHeader className="pb-2">
						<h4 className="text-sm font-medium text-foreground">Your Applications</h4>
					</CardHeader>
					<Divider />
					<CardBody className="pt-3">
						<div className="space-y-2">
							{userApplications.map((app) => (
								<div
									key={app.name}
									className="flex items-center justify-between p-2 rounded-lg bg-content2/50 hover:bg-content2 transition-colors"
								>
									<div className="flex items-center space-x-3">
										<Switch
											size="sm"
											isSelected={app.enabled}
											onValueChange={() => toggleApplication(app.name)}
											color="primary"
										/>
										<div>
											<p className="text-sm font-medium text-foreground">{app.name}</p>
											{app.isDefault && (
												<Chip size="sm" color="secondary" variant="flat" className="text-xs">
													Default
												</Chip>
											)}
										</div>
									</div>
									{!app.isDefault && (
										<Button
											size="sm"
											variant="light"
											color="danger"
											isIconOnly
											onPress={() => removeApplication(app.name)}
										>
											<Trash2 className="w-3 h-3" />
										</Button>
									)}
								</div>
							))}
						</div>
					</CardBody>
				</Card>
			)}

			{/* Add Custom Application */}
			{showAddCustom && (
				<Card className="bg-content1">
					<CardBody className="p-3">
						{!showAddCustomInput ? (
							<Button
								variant="bordered"
								size="sm"
								startContent={<Plus className="w-4 h-4" />}
								onPress={() => setShowAddCustomInput(true)}
								className="w-full"
							>
								Add Custom Application
							</Button>
						) : (
							<div className="space-y-2">
								<div className="flex space-x-2">
									<Input
										placeholder="Enter application name..."
										value={customAppName}
										onValueChange={setCustomAppName}
										size="sm"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleAddCustomApp();
											} else if (e.key === "Escape") {
												setShowAddCustomInput(false);
												setCustomAppName("");
											}
										}}
										autoFocus
									/>
									<Button
										size="sm"
										color="primary"
										onPress={handleAddCustomApp}
										isDisabled={!customAppName.trim()}
									>
										Add
									</Button>
									<Button
										size="sm"
										variant="light"
										isIconOnly
										onPress={() => {
											setShowAddCustomInput(false);
											setCustomAppName("");
										}}
									>
										<X className="w-4 h-4" />
									</Button>
								</div>
							</div>
						)}
					</CardBody>
				</Card>
			)}

			{/* Available Applications */}
			{availableApplications.length > 0 && (
				<Card className="bg-content1">
					<CardHeader className="pb-2">
						<h4 className="text-sm font-medium text-foreground">Add Applications</h4>
					</CardHeader>
					<Divider />
					<CardBody className="pt-3">
						<div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
							{availableApplications.map((appName) => (
								<Button
									key={appName}
									variant="bordered"
									size="sm"
									className="justify-start"
									startContent={<Plus className="w-3 h-3" />}
									onPress={() => handleAddFromList(appName)}
								>
									{appName}
								</Button>
							))}
						</div>
					</CardBody>
				</Card>
			)}

			{/* Complete Button */}
			{onComplete && (
				<div className="pt-2">
					<Button
						color="primary"
						size="lg"
						className="w-full"
						onPress={onComplete}
						isDisabled={enabledCount === 0}
					>
						Continue with {enabledCount} Application{enabledCount !== 1 ? "s" : ""}
					</Button>
				</div>
			)}
		</div>
	);
}
