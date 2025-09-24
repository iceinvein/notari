import { useRef, useState, useCallback } from "react";
import type { ProofPack, RedactionArea } from "../../types";

interface RedactionCanvasProps {
  proofPack: ProofPack;
  redactionAreas: RedactionArea[];
  currentTool: "select" | "redact";
  onAddRedactionArea: (area: RedactionArea) => void;
}

export function RedactionCanvas({ 
  proofPack, 
  redactionAreas, 
  currentTool, 
  onAddRedactionArea 
}: RedactionCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Mock content for demonstration - in real app this would be actual proof pack content
  const mockContent = {
    type: "document",
    title: proofPack.metadata.title || "Document Preview",
    content: `
      This is a sample document content that would be displayed in the redaction interface.
      
      Personal Information:
      Name: John Doe
      Email: john.doe@example.com
      Phone: (555) 123-4567
      
      Financial Information:
      Account Number: 1234-5678-9012-3456
      Balance: $5,432.10
      
      Work Content:
      The research methodology involves analyzing data patterns to identify
      correlations between user behavior and system performance metrics.
      
      Confidential Notes:
      Internal project code: PROJECT-ALPHA-2024
      Meeting notes with stakeholders regarding budget allocation.
    `,
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== "redact") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentSelection({ x, y, width: 0, height: 0 });
  }, [currentTool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || currentTool !== "redact") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;

    setCurrentSelection({
      x: width < 0 ? currentX : startPoint.x,
      y: height < 0 ? currentY : startPoint.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }, [isDrawing, startPoint, currentTool]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentSelection || currentTool !== "redact") return;

    // Only create redaction area if selection is large enough
    if (currentSelection.width > 10 && currentSelection.height > 10) {
      const newRedactionArea: RedactionArea = {
        id: `redaction-${Date.now()}`,
        type: "visual",
        coordinates: {
          x: currentSelection.x,
          y: currentSelection.y,
          width: currentSelection.width,
          height: currentSelection.height,
        },
        reason: "User-selected sensitive content",
        timestamp: Date.now(),
      };

      onAddRedactionArea(newRedactionArea);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentSelection(null);
  }, [isDrawing, currentSelection, currentTool, onAddRedactionArea]);

  return (
    <div className="relative">
      {/* Content Display */}
      <div
        ref={canvasRef}
        className={`relative bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-[500px] overflow-hidden ${
          currentTool === "redact" ? "cursor-crosshair" : "cursor-default"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Document Header */}
        <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {mockContent.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Proof Pack ID: {proofPack.id.slice(-8)} • Created: {new Date(proofPack.metadata.created).toLocaleDateString()}
          </p>
        </div>

        {/* Document Content */}
        <div className="space-y-4 text-gray-800 dark:text-gray-200 leading-relaxed">
          {mockContent.content.split('\n').map((line, index) => (
            <div key={index} className={line.trim() === '' ? 'h-4' : ''}>
              {line.trim() !== '' && (
                <p className={line.includes(':') && line.split(':')[1]?.trim() ? 'font-medium' : ''}>
                  {line.trim()}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Existing Redaction Areas */}
        {redactionAreas.map((area) => (
          area.coordinates && (
            <div
              key={area.id}
              className="absolute bg-red-500/30 border-2 border-red-500 pointer-events-none"
              style={{
                left: area.coordinates.x,
                top: area.coordinates.y,
                width: area.coordinates.width,
                height: area.coordinates.height,
              }}
            >
              <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
                REDACTED
              </div>
            </div>
          )
        ))}

        {/* Current Selection */}
        {currentSelection && isDrawing && (
          <div
            className="absolute bg-yellow-400/30 border-2 border-yellow-500 border-dashed pointer-events-none"
            style={{
              left: currentSelection.x,
              top: currentSelection.y,
              width: currentSelection.width,
              height: currentSelection.height,
            }}
          />
        )}
      </div>

      {/* Tool Instructions */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-3 h-3 rounded-full ${currentTool === "redact" ? "bg-yellow-500" : "bg-blue-500"}`} />
          <span className="font-medium">
            {currentTool === "redact" ? "Redaction Mode" : "Selection Mode"}
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {currentTool === "redact" 
              ? "Click and drag to select areas to redact" 
              : "Click to select and view content"
            }
          </span>
        </div>
      </div>
    </div>
  );
}