import React, { useState, useRef, useCallback } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import type { RedactionArea, Rectangle } from '../../types/redaction.types';

interface RedactionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  contentImageUrl: string;
  sessionId: string;
  onRedactionComplete: (areas: RedactionArea[]) => void;
}

interface SelectionState {
  isSelecting: boolean;
  startPoint: { x: number; y: number } | null;
  currentArea: Rectangle | null;
}

export const RedactionSelector: React.FC<RedactionSelectorProps> = ({
  isOpen,
  onClose,
  contentImageUrl,
  sessionId,
  onRedactionComplete,
}) => {
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([]);
  const [selectionState, setSelectionState] = useState<SelectionState>({
    isSelecting: false,
    startPoint: null,
    currentArea: null,
  });
  const [reason, setReason] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setSelectionState({
      isSelecting: true,
      startPoint: { x, y },
      currentArea: null,
    });
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectionState.isSelecting || !selectionState.startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const area: Rectangle = {
      x: Math.min(selectionState.startPoint.x, currentX),
      y: Math.min(selectionState.startPoint.y, currentY),
      width: Math.abs(currentX - selectionState.startPoint.x),
      height: Math.abs(currentY - selectionState.startPoint.y),
    };

    setSelectionState(prev => ({
      ...prev,
      currentArea: area,
    }));

    // Redraw canvas with current selection
    drawCanvas(area);
  }, [selectionState.isSelecting, selectionState.startPoint]);

  const handleMouseUp = useCallback(() => {
    if (!selectionState.isSelecting || !selectionState.currentArea) return;

    // Only add areas with meaningful size
    if (selectionState.currentArea.width > 10 && selectionState.currentArea.height > 10) {
      const newArea: RedactionArea = {
        id: `redaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'rectangle',
        coordinates: selectionState.currentArea,
        sessionId,
        timestamp: Date.now(),
        reason: reason || 'Sensitive information',
      };

      setRedactionAreas(prev => [...prev, newArea]);
    }

    setSelectionState({
      isSelecting: false,
      startPoint: null,
      currentArea: null,
    });

    // Redraw canvas without current selection
    drawCanvas();
  }, [selectionState.isSelecting, selectionState.currentArea, sessionId, reason]);

  const drawCanvas = useCallback((currentSelection?: Rectangle) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw existing redaction areas
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;

    redactionAreas.forEach(area => {
      if (area.coordinates) {
        const { x, y, width, height } = area.coordinates;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
      }
    });

    // Draw current selection
    if (currentSelection) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.fillRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
      ctx.strokeRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
    }
  }, [redactionAreas]);

  const handleImageLoad = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    // Set canvas size to match image
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    drawCanvas();
  }, [drawCanvas]);

  const removeRedactionArea = useCallback((areaId: string) => {
    setRedactionAreas(prev => prev.filter(area => area.id !== areaId));
  }, []);

  const handleComplete = useCallback(() => {
    onRedactionComplete(redactionAreas);
    onClose();
  }, [redactionAreas, onRedactionComplete, onClose]);

  const handleCancel = useCallback(() => {
    setRedactionAreas([]);
    setReason('');
    onClose();
  }, [onClose]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleCancel}
      size="5xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          <h2>Select Areas to Redact</h2>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Click and drag to select areas you want to redact. Selected areas will be hidden from verifiers while maintaining proof integrity.
            </div>
            
            <div className="relative border border-gray-300 rounded-lg overflow-hidden">
              <img
                ref={imageRef}
                src={contentImageUrl}
                alt="Content to redact"
                className="hidden"
                onLoad={handleImageLoad}
              />
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-96 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Redaction Reason (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Personal information, Confidential data"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {redactionAreas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Selected Redaction Areas ({redactionAreas.length})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {redactionAreas.map((area, index) => (
                    <div key={area.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">
                        Area {index + 1}: {area.coordinates?.width}×{area.coordinates?.height}px
                        {area.reason && ` - ${area.reason}`}
                      </span>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeRedactionArea(area.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleCancel}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleComplete}
            isDisabled={redactionAreas.length === 0}
          >
            Apply Redactions ({redactionAreas.length})
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};