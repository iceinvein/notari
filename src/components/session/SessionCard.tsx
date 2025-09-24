import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Chip,
  Button,
  Progress,
} from "@heroui/react";
import type { WorkSession } from "../../types";

interface SessionCardProps {
  session: WorkSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "paused":
        return "warning";
      case "completed":
        return "primary";
      case "failed":
        return "danger";
      default:
        return "default";
    }
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const minutes = Math.floor(duration / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getIntegrityScore = () => {
    // Mock integrity score calculation
    return Math.floor(Math.random() * 20) + 80; // 80-100%
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {session.id.slice(-2).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Session {session.id.slice(-4)}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(session.startTime)}
              </p>
            </div>
          </div>
          <Chip
            color={getStatusColor(session.status)}
            variant="flat"
            size="sm"
          >
            {session.status.toUpperCase()}
          </Chip>
        </div>
      </CardHeader>

      <CardBody className="py-2">
        <div className="space-y-3">
          {/* Duration */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Duration:</span>
            <span className="font-medium">
              {formatDuration(session.startTime, session.endTime)}
            </span>
          </div>

          {/* Capture Settings */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Capture:</span>
            <div className="flex space-x-1">
              {session.captureConfig.captureScreen && (
                <Chip size="sm" variant="flat" color="primary">Screen</Chip>
              )}
              {session.captureConfig.captureKeystrokes && (
                <Chip size="sm" variant="flat" color="secondary">Keys</Chip>
              )}
              {session.captureConfig.captureMouse && (
                <Chip size="sm" variant="flat" color="success">Mouse</Chip>
              )}
            </div>
          </div>

          {/* Integrity Score */}
          {session.status === "completed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Integrity:</span>
                <span className="font-medium text-success">{getIntegrityScore()}%</span>
              </div>
              <Progress
                value={getIntegrityScore()}
                color="success"
                size="sm"
                className="w-full"
              />
            </div>
          )}
        </div>
      </CardBody>

      <CardFooter className="pt-2">
        <div className="flex space-x-2 w-full">
          <Button
            size="sm"
            variant="flat"
            className="flex-1"
            isDisabled={session.status !== "completed"}
          >
            View Details
          </Button>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            className="flex-1"
            isDisabled={session.status !== "completed"}
          >
            Create Proof Pack
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}