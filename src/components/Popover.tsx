import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import type React from "react";
import { useEffect, useRef } from "react";

const Popover: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the container when the component mounts to enable keyboard navigation
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full outline-none animate-in fade-in-0 slide-in-from-top-2 duration-200 rounded-xl overflow-hidden bg-gray-900/95 backdrop-blur-md shadow-2xl border border-gray-700/50"
      tabIndex={-1}
    >
      <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
        <CardHeader className="pb-3 px-4 pt-6">
          <div className="flex flex-col w-full text-center">
            <h2 className="text-2xl font-bold text-white">Notari</h2>
          </div>
        </CardHeader>
        <Divider className="bg-gray-700/50" />
        <CardBody className="pt-6 px-4 pb-4">
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Tamper-evident proof-of-work verification through cryptographically secure session
                  capture, AI-powered analysis, and blockchain anchoring.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Notari is a desktop application that combats false positives from AI detection
                  tools by providing verifiable evidence of human work through secure work session
                  capture, AI-powered content analysis, and immutable blockchain verification.
                </p>
              </div>

              <Button
                ref={buttonRef}
                color="primary"
                size="lg"
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Get Started
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default Popover;
