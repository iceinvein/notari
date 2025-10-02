import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";

type BlockchainConfig = {
	enabled: boolean;
	environment: string;
	chain_id: number;
	chain_name: string;
	auto_anchor: boolean;
	has_wallet: boolean;
	wallet_address: string | null;
};

type ChainInfo = {
	chain_id: number;
	name: string;
	rpc_url: string;
	contract_address: string;
	explorer_url: string;
	currency_symbol: string;
};

export default function BlockchainSettings() {
	const [config, setConfig] = useState<BlockchainConfig | null>(null);
	const [chains, setChains] = useState<ChainInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const toast = useToast();

	// Wallet setup
	const [showWalletSetup, setShowWalletSetup] = useState(false);
	const [privateKey, setPrivateKey] = useState("");
	const [showPrivateKey, setShowPrivateKey] = useState(false);
	const [derivedAddress, setDerivedAddress] = useState("");
	const [validatingKey, setValidatingKey] = useState(false);
	const [keyError, setKeyError] = useState("");

	// Balance and cost
	const [balance, setBalance] = useState<number | null>(null);
	const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
	const [loadingBalance, setLoadingBalance] = useState(false);

	// Connection test
	const [testingConnection, setTestingConnection] = useState(false);
	const [connectionResult, setConnectionResult] = useState("");

	const loadConfig = useCallback(async () => {
		try {
			const cfg = await invoke<BlockchainConfig>("get_blockchain_config");
			setConfig(cfg);
		} catch (error) {
			console.error("Failed to load blockchain config:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	const loadChains = useCallback(async () => {
		try {
			const chainList = await invoke<ChainInfo[]>("get_available_chains");
			setChains(chainList);
		} catch (error) {
			console.error("Failed to load chains:", error);
		}
	}, []);

	useEffect(() => {
		loadConfig();
		loadChains();
	}, [loadConfig, loadChains]);

	const handleToggleEnabled = async (enabled: boolean) => {
		if (!config) return;

		setSaving(true);
		try {
			await invoke("set_blockchain_config", {
				enabled,
				environment: config.environment,
				chainId: config.chain_id,
				autoAnchor: config.auto_anchor,
			});
			setConfig({ ...config, enabled });
			toast.success(
				"Blockchain Settings Updated",
				`Blockchain anchoring ${enabled ? "enabled" : "disabled"}`
			);
		} catch (error) {
			console.error("Failed to update config:", error);
			toast.error("Update Failed", `Failed to update: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handleChainChange = async (chainId: string) => {
		if (!config) return;

		const chain = chains.find((c) => c.chain_id === Number(chainId));
		if (!chain) return;

		setSaving(true);
		try {
			await invoke("set_blockchain_config", {
				enabled: config.enabled,
				environment: config.environment,
				chainId: chain.chain_id,
				autoAnchor: config.auto_anchor,
			});
			setConfig({ ...config, chain_id: chain.chain_id, chain_name: chain.name });
			toast.success("Chain Updated", `Switched to ${chain.name}`);
		} catch (error) {
			console.error("Failed to update chain:", error);
			toast.error("Update Failed", `Failed to update: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handleEnvironmentChange = async (environment: string) => {
		if (!config) return;

		setSaving(true);
		try {
			await invoke("set_blockchain_config", {
				enabled: config.enabled,
				environment,
				chainId: config.chain_id,
				autoAnchor: config.auto_anchor,
			});
			setConfig({ ...config, environment });
			toast.success("Environment Updated", `Switched to ${environment}`);
		} catch (error) {
			console.error("Failed to update environment:", error);
			toast.error("Update Failed", `Failed to update: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handleAutoAnchorChange = async (autoAnchor: boolean) => {
		if (!config) return;

		setSaving(true);
		try {
			await invoke("set_blockchain_config", {
				enabled: config.enabled,
				environment: config.environment,
				chainId: config.chain_id,
				autoAnchor,
			});
			setConfig({ ...config, auto_anchor: autoAnchor });
			toast.success(
				"Auto-Anchor Updated",
				`Auto-anchor ${autoAnchor ? "enabled" : "disabled"}`
			);
		} catch (error) {
			console.error("Failed to update auto-anchor:", error);
			toast.error("Update Failed", `Failed to update: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handlePrivateKeyChange = async (value: string) => {
		setPrivateKey(value);
		setKeyError("");
		setDerivedAddress("");

		if (value.length === 64 || value.length === 66) {
			setValidatingKey(true);
			try {
				const isValid = await invoke<boolean>("validate_private_key", { privateKey: value });
				if (isValid) {
					const address = await invoke<string>("derive_address", { privateKey: value });
					setDerivedAddress(address);
				}
			} catch (error) {
				setKeyError(error as string);
			} finally {
				setValidatingKey(false);
			}
		}
	};

	const handleStorePrivateKey = async () => {
		if (!privateKey || !derivedAddress) return;

		setSaving(true);
		try {
			await invoke("store_private_key", { privateKey });
			setShowWalletSetup(false);
			setPrivateKey("");
			setDerivedAddress("");
			await loadConfig();
			toast.success("Wallet Configured", "Private key stored successfully");
		} catch (error) {
			console.error("Failed to store private key:", error);
			toast.error("Failed to Store Key", `Failed to store private key: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteWallet = async () => {
		if (!confirm("Are you sure you want to delete your wallet? This cannot be undone.")) {
			return;
		}

		setSaving(true);
		try {
			await invoke("delete_private_key");
			await loadConfig();
			toast.success("Wallet Deleted", "Wallet deleted successfully");
		} catch (error) {
			console.error("Failed to delete wallet:", error);
			toast.error("Delete Failed", `Failed to delete wallet: ${error}`);
		} finally {
			setSaving(false);
		}
	};

	const handleLoadBalance = async () => {
		setLoadingBalance(true);
		try {
			const bal = await invoke<number>("get_balance");
			setBalance(bal);

			const cost = await invoke<number>("estimate_anchor_cost");
			setEstimatedCost(cost);
		} catch (error) {
			console.error("Failed to load balance:", error);
			toast.error("Failed to Load Balance", `Failed to load balance: ${error}`);
		} finally {
			setLoadingBalance(false);
		}
	};

	const handleTestConnection = async () => {
		setTestingConnection(true);
		setConnectionResult("");
		try {
			const result = await invoke<string>("test_connection");
			setConnectionResult(result);
		} catch (error) {
			setConnectionResult(`Error: ${error}`);
		} finally {
			setTestingConnection(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="w-6 h-6 animate-spin text-primary" />
			</div>
		);
	}

	if (!config) {
		return <div className="text-center py-8 text-foreground-500">Failed to load configuration</div>;
	}

	const selectedChain = chains.find((c) => c.chain_id === config.chain_id);

	return (
		<div className="space-y-4">
			{/* Enable/Disable */}
			<Card className="bg-content1">
				<CardBody>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-foreground">Blockchain Anchoring</p>
							<p className="text-xs text-foreground-500">
								Anchor evidence to blockchain for immutable timestamps
							</p>
						</div>
						<Switch
							isSelected={config.enabled}
							onValueChange={handleToggleEnabled}
							isDisabled={saving}
						/>
					</div>
				</CardBody>
			</Card>

			{config.enabled && (
				<>
					{/* Environment Selection */}
					<Card className="bg-content1">
						<CardHeader>
							<h4 className="text-sm font-medium text-foreground">Environment</h4>
						</CardHeader>
						<Divider />
						<CardBody>
							<Select
								label="Environment"
								selectedKeys={[config.environment]}
								onChange={(e) => handleEnvironmentChange(e.target.value)}
								isDisabled={saving}
							>
								<SelectItem key="Mock">Mock (Development)</SelectItem>
								<SelectItem key="Testnet">Testnet (Free Testing)</SelectItem>
								<SelectItem key="Mainnet">Mainnet (Production)</SelectItem>
							</Select>
						</CardBody>
					</Card>

					{/* Chain Selection */}
					{config.environment !== "Mock" && (
						<Card className="bg-content1">
							<CardHeader>
								<h4 className="text-sm font-medium text-foreground">Blockchain Network</h4>
							</CardHeader>
							<Divider />
							<CardBody className="space-y-3">
								<Select
									label="Network"
									selectedKeys={[config.chain_id.toString()]}
									onChange={(e) => handleChainChange(e.target.value)}
									isDisabled={saving}
								>
									{chains.map((chain) => (
										<SelectItem key={chain.chain_id.toString()}>{chain.name}</SelectItem>
									))}
								</Select>

								{selectedChain && (
									<div className="text-xs text-foreground-500 space-y-1">
										<p>
											<span className="font-medium">Currency:</span> {selectedChain.currency_symbol}
										</p>
										<p>
											<span className="font-medium">Explorer:</span>{" "}
											<a
												href={selectedChain.explorer_url}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary hover:underline"
											>
												{selectedChain.explorer_url}
											</a>
										</p>
									</div>
								)}
							</CardBody>
						</Card>
					)}

					{/* Wallet Configuration */}
					{config.environment !== "Mock" && (
						<Card className="bg-content1">
							<CardHeader>
								<div className="flex items-center space-x-2">
									<Wallet className="w-4 h-4" />
									<h4 className="text-sm font-medium text-foreground">Wallet</h4>
								</div>
							</CardHeader>
							<Divider />
							<CardBody className="space-y-3">
								{config.has_wallet ? (
									<>
										<div className="flex items-center justify-between p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
											<div className="flex items-center space-x-2">
												<CheckCircle2 className="w-4 h-4 text-success" />
												<div>
													<p className="text-sm font-medium text-foreground">Wallet Connected</p>
													<p className="text-xs text-foreground-500 font-mono">
														{config.wallet_address}
													</p>
												</div>
											</div>
										</div>

										<div className="flex space-x-2">
											<Button
												size="sm"
												variant="flat"
												onPress={handleLoadBalance}
												isLoading={loadingBalance}
												className="flex-1"
											>
												{loadingBalance ? "Loading..." : "Check Balance"}
											</Button>
											<Button
												size="sm"
												variant="flat"
												color="danger"
												onPress={handleDeleteWallet}
												isDisabled={saving}
											>
												Remove Wallet
											</Button>
										</div>

										{balance !== null && (
											<div className="p-3 bg-content2 rounded-lg space-y-2">
												<div className="flex justify-between text-sm">
													<span className="text-foreground-500">Balance:</span>
													<span className="font-medium text-foreground">
														{balance.toFixed(4)} {selectedChain?.currency_symbol}
													</span>
												</div>
												{estimatedCost !== null && (
													<div className="flex justify-between text-sm">
														<span className="text-foreground-500">Cost per anchor:</span>
														<span className="font-medium text-foreground">
															~{estimatedCost.toFixed(6)} {selectedChain?.currency_symbol}
														</span>
													</div>
												)}
											</div>
										)}
									</>
								) : !showWalletSetup ? (
									<div className="space-y-3">
										<div className="flex items-center space-x-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
											<AlertCircle className="w-4 h-4 text-warning" />
											<p className="text-sm text-foreground-500">
												No wallet configured. Add your private key to enable blockchain anchoring.
											</p>
										</div>
										<Button
											size="sm"
											variant="flat"
											color="primary"
											onPress={() => setShowWalletSetup(true)}
											className="w-full"
										>
											Add Wallet
										</Button>
									</div>
								) : (
									<div className="space-y-3">
										<Input
											type={showPrivateKey ? "text" : "password"}
											label="Private Key"
											placeholder="0x..."
											value={privateKey}
											onValueChange={handlePrivateKeyChange}
											isDisabled={saving}
											endContent={
												<button
													type="button"
													onClick={() => setShowPrivateKey(!showPrivateKey)}
													className="focus:outline-none"
												>
													{showPrivateKey ? (
														<EyeOff className="w-4 h-4 text-foreground-400" />
													) : (
														<Eye className="w-4 h-4 text-foreground-400" />
													)}
												</button>
											}
											description="Your private key is stored encrypted in the system keychain"
											errorMessage={keyError}
											isInvalid={!!keyError}
										/>

										{validatingKey && (
											<div className="flex items-center space-x-2 text-sm text-foreground-500">
												<Loader2 className="w-4 h-4 animate-spin" />
												<span>Validating...</span>
											</div>
										)}

										{derivedAddress && (
											<div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
												<p className="text-xs text-foreground-500 mb-1">Derived Address:</p>
												<p className="text-sm font-mono text-foreground">{derivedAddress}</p>
											</div>
										)}

										<div className="flex space-x-2">
											<Button
												size="sm"
												variant="flat"
												onPress={() => {
													setShowWalletSetup(false);
													setPrivateKey("");
													setDerivedAddress("");
													setKeyError("");
												}}
												isDisabled={saving}
												className="flex-1"
											>
												Cancel
											</Button>
											<Button
												size="sm"
												color="primary"
												onPress={handleStorePrivateKey}
												isDisabled={!derivedAddress || saving}
												isLoading={saving}
												className="flex-1"
											>
												{saving ? "Storing..." : "Store Key"}
											</Button>
										</div>
									</div>
								)}
							</CardBody>
						</Card>
					)}

					{/* Auto-anchor */}
					<Card className="bg-content1">
						<CardBody>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-foreground">Auto-anchor Recordings</p>
									<p className="text-xs text-foreground-500">
										Automatically anchor recordings to blockchain after completion
									</p>
								</div>
								<Switch
									isSelected={config.auto_anchor}
									onValueChange={handleAutoAnchorChange}
									isDisabled={saving || !config.has_wallet}
								/>
							</div>
						</CardBody>
					</Card>

					{/* Connection Test */}
					{config.has_wallet && (
						<Card className="bg-content1">
							<CardHeader>
								<h4 className="text-sm font-medium text-foreground">Connection Test</h4>
							</CardHeader>
							<Divider />
							<CardBody className="space-y-3">
								<Button
									size="sm"
									variant="flat"
									onPress={handleTestConnection}
									isLoading={testingConnection}
									className="w-full"
								>
									{testingConnection ? "Testing..." : "Test Connection"}
								</Button>

								{connectionResult && (
									<div
										className={`p-3 rounded-lg text-sm ${connectionResult.startsWith("Error") ? "bg-danger-50 dark:bg-danger-900/20 text-danger" : "bg-success-50 dark:bg-success-900/20 text-success"}`}
									>
										{connectionResult}
									</div>
								)}
							</CardBody>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
