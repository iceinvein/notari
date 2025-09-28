import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { ArrowLeft, Settings, Shield } from "lucide-react";
import type { ReactNode } from "react";

type AppHeaderProps = {
	title: string;
	subtitle?: string;
	showBackButton?: boolean;
	onBack?: () => void;
	showSettingsButton?: boolean;
	onSettings?: () => void;
	statusChip?: {
		text: string;
		color: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
		variant?: "solid" | "bordered" | "light" | "flat" | "faded" | "shadow" | "dot";
	};
	rightContent?: ReactNode;
};

export default function AppHeader({
	title,
	subtitle,
	showBackButton = false,
	onBack,
	showSettingsButton = true,
	onSettings,
	statusChip,
	rightContent,
}: AppHeaderProps) {
	return (
		<div className="flex flex-col w-full">
			<div className="flex items-center justify-between">
				{/* Left side - Back button or App icon */}
				<div className="flex items-center space-x-3">
					{showBackButton && onBack ? (
						<Button
							isIconOnly
							variant="light"
							size="sm"
							onPress={onBack}
							className="text-foreground-500 hover:text-foreground"
						>
							<ArrowLeft className="w-4 h-4" />
						</Button>
					) : (
						<div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
							<Shield className="w-4 h-4 text-primary-foreground" />
						</div>
					)}
					<div>
						<h2 className="text-lg font-bold text-foreground">{title}</h2>
						{subtitle && <p className="text-xs text-foreground-500">{subtitle}</p>}
					</div>
				</div>

				{/* Right side - Status chip, custom content, or settings */}
				<div className="flex items-center space-x-2">
					{statusChip && (
						<Chip
							size="sm"
							color={statusChip.color}
							variant={statusChip.variant || "dot"}
							classNames={{
								base: `bg-${statusChip.color}-500/20 border-${statusChip.color}-500/50`,
								content: `text-${statusChip.color}-400 text-xs`,
							}}
						>
							{statusChip.text}
						</Chip>
					)}

					{rightContent}

					{showSettingsButton && onSettings && (
						<Button
							isIconOnly
							variant="light"
							size="sm"
							onPress={onSettings}
							className="text-foreground-500 hover:text-foreground"
						>
							<Settings className="w-4 h-4" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
