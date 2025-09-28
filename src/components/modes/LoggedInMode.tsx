import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import type React from "react";
import ThemeToggle from "../ThemeToggle";

interface LoggedInModeProps {
	onLogout: () => void;
	onStartSession: () => void;
}

const LoggedInMode: React.FC<LoggedInModeProps> = ({ onLogout, onStartSession }) => {
	return (
		<Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
			<CardHeader className="pb-3 px-4 pt-6">
				<div className="flex flex-col w-full">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<Avatar size="sm" name="User" className="bg-blue-600 text-white" />
							<div>
								<h2 className="text-lg font-bold text-foreground">Welcome back!</h2>
								<p className="text-xs text-foreground-500">User</p>
							</div>
						</div>
						<Chip
							size="sm"
							color="success"
							variant="dot"
							classNames={{
								base: "bg-green-500/20 border-green-500/50",
								content: "text-green-400 text-xs",
							}}
						>
							Online
						</Chip>
					</div>
				</div>
			</CardHeader>
			<Divider />
			<CardBody className="pt-6 px-4 pb-4">
				<div className="space-y-6">
					{/* Quick Stats */}
					<div className="grid grid-cols-2 gap-3">
						<div className="bg-content2 rounded-lg p-3 text-center">
							<div className="text-lg font-bold text-foreground">12</div>
							<div className="text-xs text-foreground-500">Sessions</div>
						</div>
						<div className="bg-content2 rounded-lg p-3 text-center">
							<div className="text-lg font-bold text-foreground">8.5h</div>
							<div className="text-xs text-foreground-500">Total Time</div>
						</div>
					</div>

					{/* Recent Activity */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
						<div className="space-y-2">
							<div className="flex items-center justify-between p-2 bg-content2 rounded-lg">
								<div className="flex items-center space-x-2">
									<Chip size="sm" color="primary" variant="dot">
										Writing
									</Chip>
								</div>
								<span className="text-xs text-foreground-500">2h ago</span>
							</div>
							<div className="flex items-center justify-between p-2 bg-content2 rounded-lg">
								<div className="flex items-center space-x-2">
									<Chip size="sm" color="success" variant="dot">
										Code Review
									</Chip>
								</div>
								<span className="text-xs text-foreground-500">1d ago</span>
							</div>
							<div className="flex items-center justify-between p-2 bg-content2 rounded-lg">
								<div className="flex items-center space-x-2">
									<Chip size="sm" color="secondary" variant="dot">
										Research
									</Chip>
								</div>
								<span className="text-xs text-foreground-500">2d ago</span>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-3">
						<Button
							color="primary"
							size="lg"
							className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
							onPress={onStartSession}
						>
							Start New Session
						</Button>

						{/* Theme Toggle */}
						<div className="mb-4">
							<ThemeToggle variant="full" size="md" />
						</div>

						<div className="flex space-x-2">
							<Button variant="bordered" size="sm" className="flex-1 text-xs">
								View History
							</Button>
							<Button variant="bordered" size="sm" className="flex-1 text-xs">
								Settings
							</Button>
							<Button variant="bordered" size="sm" className="flex-1 text-xs" onPress={onLogout}>
								Logout
							</Button>
						</div>
					</div>
				</div>
			</CardBody>
		</Card>
	);
};

export default LoggedInMode;
