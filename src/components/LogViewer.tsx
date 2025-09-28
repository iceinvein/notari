import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Check, Copy, Search, Trash2, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

import { useLogger } from "../hooks/useLogger";
import { LogLevel } from "../utils/logger";

interface LogViewerProps {
	onClose?: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ onClose }) => {
	const { logs, clearLogs } = useLogger();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedLevel, setSelectedLevel] = useState<string>("all");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [isHovering, setIsHovering] = useState(false);
	const [copySuccess, setCopySuccess] = useState(false);

	// Get unique categories
	const categories = useMemo(() => {
		const cats = new Set(logs.map((log) => log.category));
		const categoryArray = Array.from(cats).sort();
		return [
			{ key: "all", label: "All Categories" },
			...categoryArray.map((cat) => ({ key: cat, label: cat })),
		];
	}, [logs]);

	// Filter logs
	const filteredLogs = useMemo(() => {
		return logs.filter((log) => {
			// Level filter
			if (selectedLevel !== "all" && log.level !== Number(selectedLevel)) {
				return false;
			}

			// Category filter
			if (selectedCategory !== "all" && log.category !== selectedCategory) {
				return false;
			}

			// Search filter
			if (searchTerm) {
				const searchLower = searchTerm.toLowerCase();
				return (
					log.message.toLowerCase().includes(searchLower) ||
					log.category.toLowerCase().includes(searchLower) ||
					(log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
				);
			}

			return true;
		});
	}, [logs, selectedLevel, selectedCategory, searchTerm]);

	const getLevelName = (level: LogLevel) => {
		return LogLevel[level];
	};

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleString();
	};

	const handleCopyLogs = async () => {
		const logText = filteredLogs
			.map((log) => {
				const timestamp = formatTimestamp(log.timestamp);
				const level = getLevelName(log.level).padEnd(5);
				const category = log.category.padEnd(12);
				const baseLog = `[${timestamp}] ${level} ${category} ${log.message}`;
				const dataLog = log.data
					? `\n    Data: ${JSON.stringify(log.data, null, 2).replace(/\n/g, "\n    ")}`
					: "";
				const stackLog = log.stack ? `\n    Stack: ${log.stack.replace(/\n/g, "\n    ")}` : "";
				return baseLog + dataLog + stackLog;
			})
			.join("\n\n");

		try {
			await navigator.clipboard.writeText(logText);
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		} catch (error) {
			// Fallback for browsers that don't support clipboard API
			console.error("Failed to copy logs:", error);
		}
	};

	return (
		<div className="flex flex-col h-full space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between flex-shrink-0">
				<h3 className="text-lg font-semibold">Application Logs</h3>
				{onClose && (
					<Button isIconOnly variant="light" onPress={onClose}>
						<X className="w-4 h-4" />
					</Button>
				)}
			</div>

			{/* Controls */}
			<div className="flex flex-wrap gap-3 flex-shrink-0">
				<Input
					placeholder="Search logs..."
					value={searchTerm}
					onValueChange={setSearchTerm}
					startContent={<Search className="w-4 h-4" />}
					className="flex-1 min-w-[200px]"
					size="sm"
				/>

				<Select
					placeholder="All Levels"
					selectedKeys={selectedLevel ? [selectedLevel] : []}
					onSelectionChange={(keys) => setSelectedLevel((Array.from(keys)[0] as string) || "all")}
					className="w-32"
					size="sm"
				>
					<SelectItem key="all">All Levels</SelectItem>
					<SelectItem key="0">Debug</SelectItem>
					<SelectItem key="1">Info</SelectItem>
					<SelectItem key="2">Warning</SelectItem>
					<SelectItem key="3">Error</SelectItem>
				</Select>

				<Select
					placeholder="All Categories"
					selectedKeys={selectedCategory ? [selectedCategory] : []}
					onSelectionChange={(keys) =>
						setSelectedCategory((Array.from(keys)[0] as string) || "all")
					}
					className="w-40"
					size="sm"
					items={categories}
				>
					{(category) => <SelectItem key={category.key}>{category.label}</SelectItem>}
				</Select>

				<Button
					size="sm"
					variant="bordered"
					color="danger"
					startContent={<Trash2 className="w-4 h-4" />}
					onPress={clearLogs}
				>
					Clear
				</Button>
			</div>

			{/* Stats */}
			<div className="flex gap-2 text-sm text-foreground-500 flex-shrink-0">
				<span>Total: {logs.length}</span>
				<span>•</span>
				<span>Filtered: {filteredLogs.length}</span>
			</div>

			{/* Logs Display */}
			<div className="flex-1 min-h-0 relative">
				{filteredLogs.length === 0 ? (
					<div className="h-full flex items-center justify-center bg-content1 rounded border border-default-200">
						<p className="text-foreground-500">No logs found</p>
					</div>
				) : (
					// biome-ignore lint/a11y/noStaticElementInteractions: We need for hovering
					<div
						className="relative h-full"
						onMouseEnter={() => setIsHovering(true)}
						onMouseLeave={() => setIsHovering(false)}
					>
						<Textarea
							value={filteredLogs
								.map((log) => {
									const timestamp = formatTimestamp(log.timestamp);
									const level = getLevelName(log.level).padEnd(5);
									const category = log.category.padEnd(12);
									const baseLog = `[${timestamp}] ${level} ${category} ${log.message}`;
									const dataLog = log.data
										? `\n    Data: ${JSON.stringify(log.data, null, 2).replace(/\n/g, "\n    ")}`
										: "";
									const stackLog = log.stack
										? `\n    Stack: ${log.stack.replace(/\n/g, "\n    ")}`
										: "";
									return baseLog + dataLog + stackLog;
								})
								.join("\n\n")}
							isReadOnly
							className="h-full"
							classNames={{
								base: "h-full",
								inputWrapper: "h-full",
								input: "font-mono text-xs leading-relaxed h-full",
							}}
							placeholder="No logs to display"
						/>

						{/* Hover Copy Button */}
						{(isHovering || copySuccess) && (
							<Button
								isIconOnly
								size="sm"
								variant="flat"
								color={copySuccess ? "success" : "default"}
								className={`absolute top-2 right-2 z-10 transition-opacity duration-200 ${
									isHovering || copySuccess ? "opacity-100" : "opacity-0"
								}`}
								onPress={handleCopyLogs}
							>
								{copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default LogViewer;
