import { Button, Card, CardBody, Chip, Progress } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  ResourceLevel,
  useTrayResourceManager,
} from "../../services/tray/TrayResourceManager";

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  resourceLevel: ResourceLevel;
  lastActivity: number;
}

interface ResourceRecommendations {
  level: ResourceLevel;
  reason: string;
  suggestions: string[];
}

export function TrayPerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [recommendations, setRecommendations] =
    useState<ResourceRecommendations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getMetrics, forceGC, getRecommendations } = useTrayResourceManager();

  // Load performance data
  const loadPerformanceData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [metricsData, recommendationsData] = await Promise.all([
        getMetrics(),
        Promise.resolve(getRecommendations()),
      ]);

      setMetrics(metricsData);
      setRecommendations(recommendationsData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load performance data";
      setError(errorMessage);
      console.error("Performance monitoring error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh performance data
  useEffect(() => {
    loadPerformanceData();

    const interval = setInterval(loadPerformanceData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle garbage collection
  const handleForceGC = async () => {
    try {
      setIsLoading(true);
      await forceGC();
      await loadPerformanceData(); // Refresh data after GC
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to force garbage collection";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Format memory usage
  const formatMemoryUsage = (bytes: number): string => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Format time since last activity
  const formatTimeSinceActivity = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get resource level color
  const getResourceLevelColor = (level: ResourceLevel) => {
    switch (level) {
      case ResourceLevel.MINIMAL:
        return "success";
      case ResourceLevel.NORMAL:
        return "primary";
      case ResourceLevel.ACTIVE:
        return "warning";
      case ResourceLevel.RECORDING:
        return "danger";
      default:
        return "default";
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Loading performance data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Performance Monitor
        </h2>
        <Button
          size="sm"
          variant="flat"
          onPress={loadPerformanceData}
          isLoading={isLoading}
          className="text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
          <CardBody className="py-2">
            <p className="text-sm text-danger-600 dark:text-danger-400">
              {error}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Current Metrics */}
      {metrics && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resource Level</span>
              <Chip
                color={getResourceLevelColor(metrics.resourceLevel)}
                variant="flat"
                size="sm"
              >
                {metrics.resourceLevel.toUpperCase()}
              </Chip>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Memory Usage</span>
                <span className="text-sm font-mono">
                  {formatMemoryUsage(metrics.memoryUsage)}
                </span>
              </div>
              <Progress
                value={Math.min(
                  (metrics.memoryUsage / (100 * 1024 * 1024)) * 100,
                  100,
                )}
                color={
                  metrics.memoryUsage > 50 * 1024 * 1024 ? "warning" : "success"
                }
                size="sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">CPU Usage</span>
                <span className="text-sm font-mono">
                  {metrics.cpuUsage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={metrics.cpuUsage}
                color={metrics.cpuUsage > 50 ? "warning" : "success"}
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Last Activity</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatTimeSinceActivity(metrics.lastActivity)}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Resource Recommendations */}
      {recommendations && (
        <Card>
          <CardBody className="space-y-3">
            <h3 className="text-sm font-medium">Recommendations</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Recommended Level</span>
                <Chip
                  color={getResourceLevelColor(recommendations.level)}
                  variant="flat"
                  size="sm"
                >
                  {recommendations.level.toUpperCase()}
                </Chip>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                {recommendations.reason}
              </p>
            </div>

            {recommendations.suggestions.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Suggestions</span>
                <ul className="space-y-1">
                  {recommendations.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-600 dark:text-gray-400 flex items-start"
                    >
                      <span className="text-primary mr-2">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="flat"
          className="w-full justify-start"
          onPress={handleForceGC}
          isLoading={isLoading}
        >
          <span className="text-sm">🗑️ Force Garbage Collection</span>
        </Button>
      </div>

      {/* Performance Tips */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardBody className="py-3">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Performance Tips
          </h4>
          <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <li>• Close the popover when not in use to save resources</li>
            <li>• Animations are disabled in minimal resource mode</li>
            <li>• Recording sessions use maximum resources for accuracy</li>
            <li>• Force garbage collection if memory usage is high</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
