import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Chip,
  Divider,
} from "@heroui/react";
import type { RedactionArea } from "../../types";

interface RedactionControlsProps {
  redactionAreas: RedactionArea[];
  onRemoveArea: (areaId: string) => void;
  onClearAll: () => void;
}

export function RedactionControls({ 
  redactionAreas, 
  onRemoveArea, 
  onClearAll 
}: RedactionControlsProps) {
  const formatCoordinates = (area: RedactionArea) => {
    if (!area.coordinates) return "N/A";
    const { x, y, width, height } = area.coordinates;
    return `${Math.round(x)}, ${Math.round(y)} (${Math.round(width)}×${Math.round(height)})`;
  };

  const getAreaSize = (area: RedactionArea) => {
    if (!area.coordinates) return 0;
    return area.coordinates.width * area.coordinates.height;
  };

  const getTotalRedactedArea = () => {
    return redactionAreas.reduce((total, area) => total + getAreaSize(area), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Redaction Areas</h4>
          {redactionAreas.length > 0 && (
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onPress={onClearAll}
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {redactionAreas.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm">No redaction areas selected</p>
            <p className="text-xs mt-1">Use the redact tool to select sensitive content</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Areas:</span>
                <span>{redactionAreas.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="font-medium">Total Size:</span>
                <span>{Math.round(getTotalRedactedArea()).toLocaleString()} px²</span>
              </div>
            </div>

            <Divider />

            {/* Individual Areas */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {redactionAreas.map((area, index) => (
                <div
                  key={area.id}
                  className="flex items-start justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Chip size="sm" color="danger" variant="flat">
                        Area {index + 1}
                      </Chip>
                      <Chip size="sm" variant="flat">
                        {area.type}
                      </Chip>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Position: {formatCoordinates(area)}</div>
                      <div>Size: {Math.round(getAreaSize(area)).toLocaleString()} px²</div>
                      {area.reason && (
                        <div className="truncate">Reason: {area.reason}</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => onRemoveArea(area.id)}
                    className="ml-2 flex-shrink-0"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}