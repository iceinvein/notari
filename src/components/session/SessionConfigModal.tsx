import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  CheckboxGroup,
  Select,
  SelectItem,
  Card,
  CardBody,
} from "@heroui/react";
import type { SessionConfig } from "../../types";

interface SessionConfigModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onStartSession: (config: SessionConfig) => void;
}

export function SessionConfigModal({ isOpen, onOpenChange, onStartSession }: SessionConfigModalProps) {
  const [config, setConfig] = useState<SessionConfig>({
    captureScreen: true,
    captureKeystrokes: true,
    captureMouse: true,
    privacyFilters: [],
    qualitySettings: "high",
  });

  const handleStartSession = () => {
    onStartSession(config);
  };

  const privacyFilterOptions = [
    { key: "passwords", label: "Password Fields" },
    { key: "personal_info", label: "Personal Information" },
    { key: "financial", label: "Financial Data" },
    { key: "browser_private", label: "Private Browsing" },
  ];

  const qualityOptions = [
    { key: "low", label: "Low (Faster, Less Storage)" },
    { key: "medium", label: "Medium (Balanced)" },
    { key: "high", label: "High (Best Quality)" },
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Configure New Session</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set up your work session capture preferences
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {/* Capture Settings */}
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-semibold mb-4">Capture Settings</h3>
                    <div className="space-y-4">
                      <Checkbox
                        isSelected={config.captureScreen}
                        onValueChange={(checked) =>
                          setConfig(prev => ({ ...prev, captureScreen: checked }))
                        }
                      >
                        <div>
                          <div className="font-medium">Screen Capture</div>
                          <div className="text-sm text-gray-500">
                            Record screen activity and visual changes
                          </div>
                        </div>
                      </Checkbox>

                      <Checkbox
                        isSelected={config.captureKeystrokes}
                        onValueChange={(checked) =>
                          setConfig(prev => ({ ...prev, captureKeystrokes: checked }))
                        }
                      >
                        <div>
                          <div className="font-medium">Keystroke Monitoring</div>
                          <div className="text-sm text-gray-500">
                            Track typing patterns and keyboard activity
                          </div>
                        </div>
                      </Checkbox>

                      <Checkbox
                        isSelected={config.captureMouse}
                        onValueChange={(checked) =>
                          setConfig(prev => ({ ...prev, captureMouse: checked }))
                        }
                      >
                        <div>
                          <div className="font-medium">Mouse Tracking</div>
                          <div className="text-sm text-gray-500">
                            Monitor mouse movements and click patterns
                          </div>
                        </div>
                      </Checkbox>
                    </div>
                  </CardBody>
                </Card>

                {/* Privacy Filters */}
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-semibold mb-4">Privacy Filters</h3>
                    <CheckboxGroup
                      value={config.privacyFilters}
                      onValueChange={(values) =>
                        setConfig(prev => ({ ...prev, privacyFilters: values }))
                      }
                    >
                      {privacyFilterOptions.map((option) => (
                        <Checkbox key={option.key} value={option.key}>
                          {option.label}
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                    <p className="text-sm text-gray-500 mt-2">
                      Selected filters will automatically redact sensitive content during capture
                    </p>
                  </CardBody>
                </Card>

                {/* Quality Settings */}
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-semibold mb-4">Quality Settings</h3>
                    <Select
                      label="Capture Quality"
                      selectedKeys={[config.qualitySettings]}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        setConfig(prev => ({ ...prev, qualitySettings: selected }));
                      }}
                    >
                      {qualityOptions.map((option) => (
                        <SelectItem key={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </CardBody>
                </Card>

                {/* Security Notice */}
                <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <CardBody>
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 text-blue-500 mt-0.5">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          Security & Privacy
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                          All captured data is encrypted locally using device-specific keys. 
                          Your work session data never leaves your device unencrypted.
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleStartSession}
                isDisabled={!config.captureScreen && !config.captureKeystrokes && !config.captureMouse}
              >
                Start Session
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}