import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import type React from "react";
import AppHeader from "../AppHeader";

interface LoginModeProps {
	onLogin: () => void;
	onSignUp: () => void;
	onRecordOnly: () => void;
}

const LoginMode: React.FC<LoginModeProps> = ({ onLogin, onSignUp, onRecordOnly }) => {
	return (
		<Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
			<CardHeader className="pb-3 px-4 pt-6">
				<AppHeader
					title="Welcome Back"
					subtitle="Sign in to your Notari account"
					showBackButton={false}
					showSettingsButton={false}
				/>
			</CardHeader>
			<Divider />
			<CardBody className="pt-6 px-4 pb-4">
				<div className="space-y-6">
					<div className="space-y-4">
						<div className="space-y-4">
							<Input
								type="email"
								label="Email"
								placeholder="Enter your email"
								variant="bordered"
								classNames={{
									base: "w-full",
									input: "text-foreground",
									inputWrapper:
										"bg-default-100 border-default-300 hover:border-default-400 focus-within:!border-primary",
									label: "text-foreground-600",
								}}
							/>
							<Input
								type="password"
								label="Password"
								placeholder="Enter your password"
								variant="bordered"
								classNames={{
									base: "w-full",
									input: "text-foreground",
									inputWrapper:
										"bg-default-100 border-default-300 hover:border-default-400 focus-within:!border-primary",
									label: "text-foreground-600",
								}}
							/>
						</div>

						<div className="space-y-3">
							<Button
								color="primary"
								size="lg"
								className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
								onPress={onLogin}
							>
								Sign In
							</Button>

							<Button
								variant="bordered"
								size="lg"
								className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
								onPress={onRecordOnly}
							>
								Record/Verify Only
							</Button>

							<div className="text-center space-y-1">
								<div>
									<span className="text-sm text-foreground-500">Don't have an account? </span>
									<button
										type="button"
										onClick={onSignUp}
										className="text-sm text-primary hover:text-primary-600 underline transition-colors"
									>
										Sign up for online profile
									</button>
								</div>
								<p className="text-xs text-foreground-400">
									Online profiles allow you to store and sync your verifications across devices
								</p>
							</div>
						</div>
					</div>
				</div>
			</CardBody>
		</Card>
	);
};

export default LoginMode;
