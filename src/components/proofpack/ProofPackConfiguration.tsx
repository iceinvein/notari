import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { useState } from "react";
import type { WorkSession } from "../../types";

interface ProofPackConfig {
  title: string;
  description: string;
  tags: string[];
  includeAIAnalysis: boolean;
  includeTimeline: boolean;
  compressionLevel: "low" | "medium" | "high";
}

interface ProofPackConfigurationProps {
  config: ProofPackConfig;
  onConfigChange: (config: ProofPackConfig) => void;
  selectedSessions: WorkSession[];
}

export function ProofPackConfiguration({
  config,
  onConfigChange,
  selectedSessions,
}: ProofPackConfigurationProps) {
  const [newTag, setNewTag] = useState("");

  const handleConfigUpdate = (updates: Partial<ProofPackConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const addTag = () => {
    if (newTag.trim() && !config.tags.includes(newTag.trim())) {
      handleConfigUpdate({
        tags: [...config.tags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleConfigUpdate({
      tags: config.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const getTotalDuration = () => {
    return selectedSessions.reduce((total, session) => {
      const duration = (session.endTime || Date.now()) - session.startTime;
      return total + Math.floor(duration / 1000 / 60); // minutes
    }, 0);
  };

  const getEstimatedSize = () => {
    const baseSizePerMinute = 50; // MB per minute (rough estimate)
    const totalMinutes = getTotalDuration();
    let estimatedSize = totalMinutes * baseSizePerMinute;

    // Adjust for compression
    switch (config.compressionLevel) {
      case "low":
        estimatedSize *= 0.9; // 10% compression
        break;
      case "medium":
        estimatedSize *= 0.7; // 30% compression
        break;
      case "high":
        estimatedSize *= 0.5; // 50% compression
        break;
    }

    // Adjust for optional components
    if (!config.includeAIAnalysis) {
      estimatedSize *= 0.8; // 20% reduction
    }
    if (!config.includeTimeline) {
      estimatedSize *= 0.9; // 10% reduction
    }

    return Math.round(estimatedSize);
  };

  const compressionOptions = [
    {
      key: "low",
      label: "Low Compression",
      description: "Fastest processing, larger file size",
    },
    {
      key: "medium",
      label: "Medium Compression",
      description: "Balanced processing time and file size",
    },
    {
      key: "high",
      label: "High Compression",
      description: "Slower processing, smallest file size",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Proof Pack Title"
            placeholder="Enter a descriptive title for your proof pack"
            value={config.title}
            onValueChange={(value) => handleConfigUpdate({ title: value })}
            isRequired
          />

          <Textarea
            label="Description"
            placeholder="Describe the work or project this proof pack represents"
            value={config.description}
            onValueChange={(value) =>
              handleConfigUpdate({ description: value })
            }
            minRows={3}
          />

          <div className="space-y-2">
            <div className="text-sm font-medium">Tags</div>
            <div className="flex space-x-2">
              <Input
                placeholder="Add a tag"
                value={newTag}
                onValueChange={setNewTag}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="flat"
                onPress={addTag}
                isDisabled={
                  !newTag.trim() || config.tags.includes(newTag.trim())
                }
              >
                Add
              </Button>
            </div>
            {config.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {config.tags.map((tag) => (
                  <Chip
                    key={tag}
                    onClose={() => removeTag(tag)}
                    variant="flat"
                    color="primary"
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Content Options */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Content Options</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <Checkbox
            isSelected={config.includeAIAnalysis}
            onValueChange={(checked) =>
              handleConfigUpdate({ includeAIAnalysis: checked })
            }
          >
            <div>
              <div className="font-medium">Include AI Analysis</div>
              <div className="text-sm text-gray-500">
                Add AI-generated summaries and insights about your work patterns
              </div>
            </div>
          </Checkbox>

          <Checkbox
            isSelected={config.includeTimeline}
            onValueChange={(checked) =>
              handleConfigUpdate({ includeTimeline: checked })
            }
          >
            <div>
              <div className="font-medium">Include Detailed Timeline</div>
              <div className="text-sm text-gray-500">
                Add chronological timeline of all captured events
              </div>
            </div>
          </Checkbox>
        </CardBody>
      </Card>

      {/* Compression Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Compression Settings</h3>
        </CardHeader>
        <CardBody>
          <Select
            label="Compression Level"
            selectedKeys={[config.compressionLevel]}
            onSelectionChange={(keys) => {
              const level = Array.from(keys)[0] as "low" | "medium" | "high";
              handleConfigUpdate({ compressionLevel: level });
            }}
          >
            {compressionOptions.map((option) => (
              <SelectItem key={option.key} textValue={option.label}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">
                    {option.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Summary */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <CardHeader>
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Proof Pack Summary
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-200 font-medium">
                Sessions:
              </span>
              <span className="ml-2">{selectedSessions.length}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-200 font-medium">
                Total Duration:
              </span>
              <span className="ml-2">
                {Math.floor(getTotalDuration() / 60)}h {getTotalDuration() % 60}
                m
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-200 font-medium">
                Estimated Size:
              </span>
              <span className="ml-2">{getEstimatedSize()} MB</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-200 font-medium">
                Compression:
              </span>
              <span className="ml-2 capitalize">{config.compressionLevel}</span>
            </div>
          </div>

          {config.tags.length > 0 && (
            <div className="mt-4">
              <span className="text-blue-700 dark:text-blue-200 font-medium text-sm">
                Tags:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {config.tags.map((tag) => (
                  <Chip key={tag} size="sm" variant="flat" color="primary">
                    {tag}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
