import React, { useState, useCallback } from 'react';
import { Button, Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { RedactionSelector } from './RedactionSelector';
import type { ProofPack, RedactionArea, RedactionPlan, RedactedProofPack } from '../../types';
import { useRedactionEngine } from '../../hooks/useRedactionEngine';

interface RedactionManagerProps {
  proofPack: ProofPack;
  onRedactionComplete: (redactedPack: RedactedProofPack) => void;
}

export const RedactionManager: React.FC<RedactionManagerProps> = ({
  proofPack,
  onRedactionComplete,
}) => {
  const [isSelectingRedactions, setIsSelectingRedactions] = useState(false);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [redactionPlan, setRedactionPlan] = useState<RedactionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { markForRedaction, applyRedactions, validateRedactionIntegrity } = useRedactionEngine();

  const sessions = proofPack.evidence.sessions;
  const currentSession = sessions[currentSessionIndex];

  const handleStartRedaction = useCallback(() => {
    setIsSelectingRedactions(true);
  }, []);

  const handleRedactionAreasSelected = useCallback(async (areas: RedactionArea[]) => {
    setIsSelectingRedactions(false);
    
    if (areas.length === 0) return;

    try {
      setIsProcessing(true);
      
      // Create redaction plan
      const plan = await markForRedaction(proofPack, areas);
      setRedactionPlan(plan);
      
      // Show warnings if any
      if (plan.warnings.length > 0) {
        console.warn('Redaction warnings:', plan.warnings);
      }
      
    } catch (error) {
      console.error('Failed to create redaction plan:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [proofPack, markForRedaction]);

  const handleApplyRedactions = useCallback(async () => {
    if (!redactionPlan) return;

    try {
      setIsProcessing(true);
      
      const redactedPack = await applyRedactions(redactionPlan);
      
      // Validate the redacted pack integrity
      const isValid = await validateRedactionIntegrity(redactedPack);
      
      if (!isValid) {
        throw new Error('Redaction integrity validation failed');
      }
      
      onRedactionComplete(redactedPack);
      
    } catch (error) {
      console.error('Failed to apply redactions:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [redactionPlan, applyRedactions, validateRedactionIntegrity, onRedactionComplete]);

  const handleCancelRedaction = useCallback(() => {
    setRedactionPlan(null);
  }, []);

  const handleNextSession = useCallback(() => {
    if (currentSessionIndex < sessions.length - 1) {
      setCurrentSessionIndex(prev => prev + 1);
    }
  }, [currentSessionIndex, sessions.length]);

  const handlePreviousSession = useCallback(() => {
    if (currentSessionIndex > 0) {
      setCurrentSessionIndex(prev => prev - 1);
    }
  }, [currentSessionIndex]);

  // Generate a mock image URL for the session content
  // In a real implementation, this would be generated from the session data
  const getSessionImageUrl = useCallback((sessionId: string) => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="24">
          Session Content Preview
        </text>
        <text x="50%" y="60%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16">
          Session ID: ${sessionId}
        </text>
      </svg>
    `)}`;
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center w-full">
            <h2 className="text-xl font-semibold">Redaction Manager</h2>
            <div className="text-sm text-gray-500">
              Proof Pack: {proofPack.id}
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Select sensitive areas in your proof pack content to redact them while maintaining verification integrity.
              Redacted areas will be hidden from verifiers but cryptographic proofs will confirm their existence.
            </div>

            {/* Session Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="bordered"
                  onPress={handlePreviousSession}
                  isDisabled={currentSessionIndex === 0}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Session {currentSessionIndex + 1} of {sessions.length}
                </span>
                <Button
                  size="sm"
                  variant="bordered"
                  onPress={handleNextSession}
                  isDisabled={currentSessionIndex === sessions.length - 1}
                >
                  Next
                </Button>
              </div>
              
              <Button
                color="primary"
                onPress={handleStartRedaction}
                isDisabled={isProcessing}
              >
                Select Areas to Redact
              </Button>
            </div>

            {/* Current Session Preview */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">
                Session Preview: {currentSession.sessionId}
              </h3>
              <div className="bg-gray-50 rounded p-4 text-center">
                <div className="text-sm text-gray-500">
                  Session content would be displayed here
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Timestamp: {new Date(currentSession.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Redaction Plan Display */}
            {redactionPlan && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-medium">Redaction Plan</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Areas to redact:</span> {redactionPlan.areas.length}
                      </div>
                      <div>
                        <span className="font-medium">Verification capability:</span>{' '}
                        <span className={`capitalize ${
                          redactionPlan.estimatedImpact.verificationCapability === 'full' 
                            ? 'text-green-600' 
                            : redactionPlan.estimatedImpact.verificationCapability === 'partial'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {redactionPlan.estimatedImpact.verificationCapability}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Affected sessions:</span> {redactionPlan.estimatedImpact.affectedSessions.length}
                      </div>
                      <div>
                        <span className="font-medium">Critical data removed:</span>{' '}
                        <span className={redactionPlan.estimatedImpact.criticalDataRemoved ? 'text-red-600' : 'text-green-600'}>
                          {redactionPlan.estimatedImpact.criticalDataRemoved ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    {redactionPlan.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <h4 className="text-sm font-medium text-yellow-800 mb-1">Warnings:</h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {redactionPlan.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        color="primary"
                        onPress={handleApplyRedactions}
                        isLoading={isProcessing}
                      >
                        Apply Redactions
                      </Button>
                      <Button
                        variant="light"
                        onPress={handleCancelRedaction}
                        isDisabled={isProcessing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Redaction Selector Modal */}
      <RedactionSelector
        isOpen={isSelectingRedactions}
        onClose={() => setIsSelectingRedactions(false)}
        contentImageUrl={getSessionImageUrl(currentSession.sessionId)}
        sessionId={currentSession.sessionId}
        onRedactionComplete={handleRedactionAreasSelected}
      />
    </div>
  );
};