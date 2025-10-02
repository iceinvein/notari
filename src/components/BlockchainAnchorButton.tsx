import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, Anchor, CheckCircle2, ExternalLink, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { BlockchainAnchorInfo } from "../hooks/useRecordingSystem";
import { useToast } from "../hooks/useToast";

type BlockchainConfig = {
	enabled: boolean;
	environment: string;
	chain_id: number;
	chain_name: string;
	auto_anchor: boolean;
	has_wallet: boolean;
	wallet_address?: string;
};

type AnchorProof =
	| {
			type: "Mock";
			hash: string;
			timestamp: string;
	  }
	| {
			type: "Ethereum";
			chain_id: number;
			chain_name: string;
			tx_hash: string;
			contract_address: string;
			block_number: number;
			explorer_url: string;
	  }
	| {
			type: "OpenTimestamps";
			ots_proof: string;
			bitcoin_block: number;
	  };

type AnchorResult = {
	success: boolean;
	anchored_at: string;
	proof: AnchorProof;
};

type BlockchainAnchorButtonProps = {
	manifestPath: string;
	anchor?: BlockchainAnchorInfo;
	onAnchored?: () => void;
};

export default function BlockchainAnchorButton({
	manifestPath,
	anchor,
	onAnchored,
}: BlockchainAnchorButtonProps) {
	const [isAnchoring, setIsAnchoring] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [localAnchor, setLocalAnchor] = useState<BlockchainAnchorInfo | null>(null);
	const [blockchainConfig, setBlockchainConfig] = useState<BlockchainConfig | null>(null);
	const [configLoading, setConfigLoading] = useState(true);
	const toast = useToast();

	// Use local anchor if available (optimistic update), otherwise use prop
	const displayAnchor = localAnchor || anchor;

	// Load blockchain config on mount
	useEffect(() => {
		const loadConfig = async () => {
			try {
				const config = await invoke<BlockchainConfig>("get_blockchain_config");
				setBlockchainConfig(config);
			} catch (err) {
				console.error("Failed to load blockchain config:", err);
			} finally {
				setConfigLoading(false);
			}
		};
		loadConfig();
	}, []);

	const handleAnchor = async () => {
		setIsAnchoring(true);
		setError(null);

		try {
			const result = await invoke<AnchorResult>("anchor_recording", {
				manifestPath,
			});

			if (result.success) {
				// Optimistically update local state
				const anchorInfo: BlockchainAnchorInfo = {
					anchored_at: result.anchored_at,
					chain_name:
						result.proof.type === "Ethereum"
							? result.proof.chain_name
							: result.proof.type === "Mock"
								? "Mock"
								: "Bitcoin (OpenTimestamps)",
					tx_hash: result.proof.type === "Ethereum" ? result.proof.tx_hash : undefined,
					explorer_url: result.proof.type === "Ethereum" ? result.proof.explorer_url : undefined,
				};
				setLocalAnchor(anchorInfo);

				// Notify parent to refresh
				onAnchored?.();

				// Show success toast
				toast.success("Recording Anchored", `Successfully anchored to ${anchorInfo.chain_name}`);
			}
		} catch (err) {
			console.error("Failed to anchor recording:", err);
			const errorMessage = err instanceof Error ? err.message : String(err);
			setError(errorMessage);
			// Show error for 5 seconds
			setTimeout(() => setError(null), 5000);

			// Show error toast
			toast.error("Anchoring Failed", errorMessage);
		} finally {
			setIsAnchoring(false);
		}
	};

	const openExplorer = () => {
		if (displayAnchor?.explorer_url && displayAnchor?.tx_hash) {
			const url = `${displayAnchor.explorer_url}/tx/${displayAnchor.tx_hash}`;
			window.open(url, "_blank");
		}
	};

	// If already anchored, show status (no tooltip - info is in the section)
	if (displayAnchor) {
		return (
			<div className="flex items-center gap-1.5">
				<Chip
					size="sm"
					variant="flat"
					color="success"
					startContent={<CheckCircle2 className="w-3.5 h-3.5" />}
					classNames={{
						base: "h-6 px-2",
						content: "text-xs font-medium",
					}}
				>
					Anchored
				</Chip>

				{displayAnchor.explorer_url && displayAnchor.tx_hash && (
					<Tooltip content="View on blockchain explorer">
						<Button
							isIconOnly
							size="sm"
							variant="light"
							onPress={openExplorer}
							aria-label="View on blockchain explorer"
							className="min-w-6 w-6 h-6"
						>
							<ExternalLink className="w-3.5 h-3.5" />
						</Button>
					</Tooltip>
				)}
			</div>
		);
	}

	// If anchoring in progress
	if (isAnchoring) {
		return (
			<Chip
				size="sm"
				variant="flat"
				color="warning"
				startContent={<Loader2 className="w-3.5 h-3.5 animate-spin" />}
				classNames={{
					base: "h-6 px-2",
					content: "text-xs font-medium",
				}}
			>
				Anchoring...
			</Chip>
		);
	}

	// If error
	if (error) {
		return (
			<Tooltip
				content={
					<div className="p-2 max-w-xs">
						<p className="text-xs font-semibold mb-1">Anchoring Failed</p>
						<p className="text-xs text-foreground-400">{error}</p>
					</div>
				}
			>
				<Chip
					size="sm"
					variant="flat"
					color="danger"
					startContent={<AlertCircle className="w-3.5 h-3.5" />}
					classNames={{
						base: "h-6 px-2",
						content: "text-xs font-medium",
					}}
				>
					Failed
				</Chip>
			</Tooltip>
		);
	}

	// If blockchain is not enabled, show info message
	if (!configLoading && (!blockchainConfig || !blockchainConfig.enabled)) {
		return (
			<Tooltip
				content={
					<div className="p-2 max-w-xs">
						<p className="text-xs font-semibold mb-1">Blockchain Anchoring Disabled</p>
						<p className="text-xs text-foreground-400">
							Enable blockchain anchoring in Settings → Blockchain to anchor recordings for
							immutable timestamps.
						</p>
					</div>
				}
			>
				<Chip
					size="sm"
					variant="flat"
					color="default"
					startContent={<Info className="w-3.5 h-3.5" />}
					classNames={{
						base: "h-6 px-2",
						content: "text-xs font-medium",
					}}
				>
					Not Enabled
				</Chip>
			</Tooltip>
		);
	}

	// If blockchain is enabled but no wallet configured (for non-Mock environments)
	if (
		!configLoading &&
		blockchainConfig &&
		blockchainConfig.enabled &&
		blockchainConfig.environment !== "Mock" &&
		!blockchainConfig.has_wallet
	) {
		return (
			<Tooltip
				content={
					<div className="p-2 max-w-xs">
						<p className="text-xs font-semibold mb-1">Wallet Not Configured</p>
						<p className="text-xs text-foreground-400">
							Configure a wallet in Settings → Blockchain to anchor recordings to{" "}
							{blockchainConfig.environment}.
						</p>
					</div>
				}
			>
				<Chip
					size="sm"
					variant="flat"
					color="warning"
					startContent={<Info className="w-3.5 h-3.5" />}
					classNames={{
						base: "h-6 px-2",
						content: "text-xs font-medium",
					}}
				>
					No Wallet
				</Chip>
			</Tooltip>
		);
	}

	// Show anchor button
	return (
		<Tooltip
			content={
				<div className="p-2">
					<p className="text-xs font-semibold mb-1">Anchor to Blockchain</p>
					<p className="text-xs text-foreground-400">
						Create an immutable timestamp for this recording on the blockchain
					</p>
				</div>
			}
		>
			<Button
				size="sm"
				variant="flat"
				color="primary"
				onPress={handleAnchor}
				startContent={<Anchor className="w-3.5 h-3.5" />}
				className="h-6 px-2 min-w-0"
			>
				<span className="text-xs font-medium">Anchor</span>
			</Button>
		</Tooltip>
	);
}
