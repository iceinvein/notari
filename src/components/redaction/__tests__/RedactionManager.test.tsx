import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RedactionManager } from '../RedactionManager';
import type { ProofPack } from '../../../types';

// Mock the redaction hook
const mockMarkForRedaction = vi.fn();
const mockApplyRedactions = vi.fn();
const mockValidateRedactionIntegrity = vi.fn();

vi.mock('../../../hooks/useRedactionEngine', () => ({
  useRedactionEngine: () => ({
    markForRedaction: mockMarkForRedaction,
    applyRedactions: mockApplyRedactions,
    validateRedactionIntegrity: mockValidateRedactionIntegrity,
  }),
}));

// Mock Hero UI components
vi.mock('@heroui/react', () => ({
  Button: ({ children, onPress, isDisabled, ...props }: any) => (
    <button onClick={onPress} disabled={isDisabled} {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  Divider: () => <hr />,
}));

// Mock RedactionSelector
vi.mock('../RedactionSelector', () => ({
  RedactionSelector: ({ isOpen, onRedactionComplete }: any) => (
    isOpen ? (
      <div data-testid="redaction-selector">
        <button onClick={() => onRedactionComplete([{
          id: 'area1',
          type: 'rectangle',
          coordinates: { x: 10, y: 10, width: 100, height: 50 },
          sessionId: 'session1',
          timestamp: Date.now(),
          reason: 'Test redaction',
        }])}>
          Complete Selection
        </button>
      </div>
    ) : null
  ),
}));

describe('RedactionManager', () => {
  const mockProofPack: ProofPack = {
    id: 'test-pack-123',
    version: '1.0',
    metadata: {
      creator: 'test-user',
      created: Date.now(),
      sessions: ['session1', 'session2'],
      totalDuration: 3600,
    },
    evidence: {
      sessions: [
        {
          sessionId: 'session1',
          encryptedContent: new ArrayBuffer(0),
          contentHash: 'hash1',
          timestamp: Date.now(),
        },
        {
          sessionId: 'session2',
          encryptedContent: new ArrayBuffer(0),
          contentHash: 'hash2',
          timestamp: Date.now(),
        },
      ],
      aiAnalysis: [],
      timeline: [],
      systemContext: {
        operatingSystem: 'macOS',
        platform: 'darwin',
        deviceId: 'test-device',
        timezone: 'UTC',
        locale: 'en-US',
        screenResolution: { width: 1920, height: 1080 },
      },
    },
    verification: {
      integrityHash: 'test-integrity-hash',
      signatures: [],
      timestamp: Date.now(),
      version: '1.0',
    },
  };

  const mockOnRedactionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock implementations
    mockMarkForRedaction.mockResolvedValue({
      proofPackId: 'test-pack',
      areas: [],
      estimatedImpact: {
        verificationCapability: 'full',
        affectedSessions: [],
        criticalDataRemoved: false,
      },
      warnings: [],
    });

    mockApplyRedactions.mockResolvedValue({
      originalId: 'test-pack',
      redactedId: 'redacted-test-pack',
      redactionData: {
        areas: [],
        proofs: [],
        redactedHash: 'hash1',
        originalHash: 'hash2',
        redactionTime: Date.now(),
      },
      partialVerificationCapable: true,
    });

    mockValidateRedactionIntegrity.mockResolvedValue(true);
  });

  it('renders redaction manager interface', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    expect(screen.getByText('Redaction Manager')).toBeInTheDocument();
    expect(screen.getByText(`Proof Pack: ${mockProofPack.id}`)).toBeInTheDocument();
  });

  it('displays session navigation', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    expect(screen.getByText('Session 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('enables next button when not on last session', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('disables previous button when on first session', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('navigates between sessions', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Session 2 of 2')).toBeInTheDocument();
  });

  it('opens redaction selector when button clicked', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    const selectButton = screen.getByText('Select Areas to Redact');
    fireEvent.click(selectButton);

    expect(screen.getByTestId('redaction-selector')).toBeInTheDocument();
  });

  it('displays current session preview', () => {
    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    expect(screen.getByText('Session Preview: session1')).toBeInTheDocument();
    expect(screen.getByText('Session content would be displayed here')).toBeInTheDocument();
  });

  it('shows redaction plan after areas selected', async () => {
    // Mock the markForRedaction to return a plan with areas
    mockMarkForRedaction.mockResolvedValue({
      proofPackId: 'test-pack',
      areas: [{
        id: 'area1',
        type: 'rectangle',
        coordinates: { x: 10, y: 10, width: 100, height: 50 },
        sessionId: 'session1',
        timestamp: Date.now(),
        reason: 'Test redaction',
      }],
      estimatedImpact: {
        verificationCapability: 'partial',
        affectedSessions: ['session1'],
        criticalDataRemoved: false,
      },
      warnings: [],
    });

    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    // Open selector
    const selectButton = screen.getByText('Select Areas to Redact');
    fireEvent.click(selectButton);

    // Complete selection with some areas
    const completeButton = screen.getByText('Complete Selection');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(screen.getByText('Redaction Plan')).toBeInTheDocument();
    });
  });

  it('displays redaction warnings when present', async () => {
    // Mock the markForRedaction to return warnings
    mockMarkForRedaction.mockResolvedValue({
      proofPackId: 'test-pack',
      areas: [{
        id: 'area1',
        type: 'rectangle',
        coordinates: { x: 10, y: 10, width: 100, height: 50 },
        sessionId: 'session1',
        timestamp: Date.now(),
        reason: 'Test redaction',
      }],
      estimatedImpact: {
        verificationCapability: 'limited',
        affectedSessions: ['session1', 'session2'],
        criticalDataRemoved: true,
      },
      warnings: ['Test warning'],
    });

    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    // Trigger redaction plan creation
    const selectButton = screen.getByText('Select Areas to Redact');
    fireEvent.click(selectButton);

    const completeButton = screen.getByText('Complete Selection');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(screen.getByText('Warnings:')).toBeInTheDocument();
      expect(screen.getByText('• Test warning')).toBeInTheDocument();
    });
  });

  it('applies redactions when confirmed', async () => {
    // Mock the markForRedaction to return a plan with areas
    mockMarkForRedaction.mockResolvedValue({
      proofPackId: 'test-pack',
      areas: [{
        id: 'area1',
        type: 'rectangle',
        coordinates: { x: 10, y: 10, width: 100, height: 50 },
        sessionId: 'session1',
        timestamp: Date.now(),
        reason: 'Test redaction',
      }],
      estimatedImpact: {
        verificationCapability: 'full',
        affectedSessions: [],
        criticalDataRemoved: false,
      },
      warnings: [],
    });

    const mockRedactedPack = {
      originalId: 'test-pack',
      redactedId: 'redacted-test-pack',
      redactionData: {
        areas: [],
        proofs: [],
        redactedHash: 'hash1',
        originalHash: 'hash2',
        redactionTime: Date.now(),
      },
      partialVerificationCapable: true,
    };

    mockApplyRedactions.mockResolvedValue(mockRedactedPack);

    render(
      <RedactionManager
        proofPack={mockProofPack}
        onRedactionComplete={mockOnRedactionComplete}
      />
    );

    // Create redaction plan
    const selectButton = screen.getByText('Select Areas to Redact');
    fireEvent.click(selectButton);

    const completeButton = screen.getByText('Complete Selection');
    fireEvent.click(completeButton);

    // Apply redactions
    await waitFor(() => {
      const applyButton = screen.getByText('Apply Redactions');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      expect(mockApplyRedactions).toHaveBeenCalled();
      expect(mockOnRedactionComplete).toHaveBeenCalled();
    });
  });
});