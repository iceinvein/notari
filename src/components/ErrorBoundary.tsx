import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Textarea } from "@heroui/input";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { appLogger } from "../utils/logger";

type Props = {
	children: ReactNode;
	fallback?: ReactNode;
	showDetails?: boolean;
}

type State = {
	hasError: boolean;
	error?: Error;
	errorInfo?: ErrorInfo;
	showDetails: boolean;
	copySuccess: boolean;
}

class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		showDetails: false,
		copySuccess: false,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error, showDetails: false, copySuccess: false };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		// Log error using main logger
		appLogger.error(
			`React Error: ${error.message}`,
			error,
			{
				componentStack: errorInfo.componentStack,
				userAgent: navigator.userAgent,
			}
		);

		// Also store in localStorage as backup
		const errorData = {
			message: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
			timestamp: new Date().toISOString(),
		};

		try {
			localStorage.setItem('notari-last-error', JSON.stringify(errorData));
		} catch (e) {
			console.error('Failed to store error in localStorage:', e);
		}

		this.setState({ errorInfo });
	}

	private getErrorDetails = () => {
		const { error, errorInfo } = this.state;
		if (!error) return '';

		return `Error: ${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}

Timestamp: ${new Date().toISOString()}

User Agent: ${navigator.userAgent}`;
	};

	private copyErrorDetails = async () => {
		try {
			await navigator.clipboard.writeText(this.getErrorDetails());
			this.setState({ copySuccess: true });
			setTimeout(() => this.setState({ copySuccess: false }), 2000);
		} catch (e) {
			console.error('Failed to copy error details:', e);
		}
	};

	public render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="flex items-center justify-center min-h-screen p-4">
						<Card className="w-full max-w-2xl">
							<CardHeader className="flex flex-row items-center gap-3">
								<AlertTriangle className="w-6 h-6 text-danger" />
								<div>
									<h2 className="text-xl font-semibold text-danger">Application Error</h2>
									<p className="text-foreground-500">Something went wrong in the application</p>
								</div>
							</CardHeader>
							<CardBody className="space-y-4">
								<div className="p-4 bg-danger/10 rounded-lg border border-danger/20">
									<p className="font-medium text-danger mb-2">Error Message:</p>
									<p className="text-sm font-mono">
										{this.state.error?.message || "An unexpected error occurred"}
									</p>
								</div>

								<div className="flex gap-2">
									<Button
										color="primary"
										startContent={<RefreshCw className="w-4 h-4" />}
										onPress={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
									>
										Try Again
									</Button>
									<Button
										variant="bordered"
										onPress={() => this.setState({ showDetails: !this.state.showDetails })}
									>
										{this.state.showDetails ? 'Hide Details' : 'Show Details'}
									</Button>
									<Button
										variant="bordered"
										startContent={<Copy className="w-4 h-4" />}
										onPress={this.copyErrorDetails}
										color={this.state.copySuccess ? "success" : "default"}
									>
										{this.state.copySuccess ? 'Copied!' : 'Copy Error'}
									</Button>
								</div>

								{this.state.showDetails && (
									<div className="space-y-3">
										<Textarea
											label="Error Details"
											value={this.getErrorDetails()}
											readOnly
											minRows={10}
											className="font-mono text-xs"
										/>
										<p className="text-xs text-foreground-500">
											This error has been saved to localStorage as 'notari-last-error' for debugging.
										</p>
									</div>
								)}
							</CardBody>
						</Card>
					</div>
				)
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
