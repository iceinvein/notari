import { Button, ButtonGroup } from "@heroui/react";
import type { WorkSession } from "../../types";

interface SessionControlsProps {
  session: WorkSession;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function SessionControls({ session, onStop, onPause, onResume }: SessionControlsProps) {
  const isActive = session.status === "active";
  const isPaused = session.status === "paused";

  return (
    <div className="flex items-center justify-center space-x-3">
      <ButtonGroup>
        {isPaused ? (
          <Button
            color="success"
            variant="solid"
            onPress={onResume}
            startContent={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            }
          >
            Resume
          </Button>
        ) : (
          <Button
            color="warning"
            variant="solid"
            onPress={onPause}
            isDisabled={!isActive}
            startContent={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            }
          >
            Pause
          </Button>
        )}
        
        <Button
          color="danger"
          variant="solid"
          onPress={onStop}
          startContent={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          }
        >
          Stop
        </Button>
      </ButtonGroup>
    </div>
  );
}