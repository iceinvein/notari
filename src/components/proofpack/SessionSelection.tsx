import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Chip,
  Button,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import type { WorkSession } from "../../types";
import { SessionStatus } from "../../types";

interface SessionSelectionProps {
  selectedSessions: WorkSession[];
  onSelectionChange: (sessions: WorkSession[]) => void;
}

export function SessionSelection({ selectedSessions, onSelectionChange }: SessionSelectionProps) {
  const [availableSessions, setAvailableSessions] = useState<WorkSession[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [filterStatus, setFilterStatus] = useState("all");

  // Mock data - in real app this would come from the session service
  useEffect(() => {
    const mockSessions: WorkSession[] = [
      {
        id: "session-1",
        userId: "user-1",
        startTime: Date.now() - 3600000,
        endTime: Date.now() - 1800000,
        status: SessionStatus.Completed,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: true,
          captureMouse: true,
          privacyFilters: [],
          qualitySettings: "high",
        },
        encryptedDataPath: "/path/to/data1",
        integrityHash: "hash1",
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 1800000,
      },
      {
        id: "session-2",
        userId: "user-1",
        startTime: Date.now() - 7200000,
        endTime: Date.now() - 5400000,
        status: SessionStatus.Completed,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: false,
          captureMouse: true,
          privacyFilters: ["passwords"],
          qualitySettings: "medium",
        },
        encryptedDataPath: "/path/to/data2",
        integrityHash: "hash2",
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 5400000,
      },
      {
        id: "session-3",
        userId: "user-1",
        startTime: Date.now() - 10800000,
        endTime: Date.now() - 9000000,
        status: SessionStatus.Completed,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: true,
          captureMouse: false,
          privacyFilters: [],
          qualitySettings: "high",
        },
        encryptedDataPath: "/path/to/data3",
        integrityHash: "hash3",
        createdAt: Date.now() - 10800000,
        updatedAt: Date.now() - 9000000,
      },
    ];
    setAvailableSessions(mockSessions);
  }, []);

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const minutes = Math.floor(duration / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFilteredSessions = () => {
    let filtered = availableSessions;

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(session => session.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return b.startTime - a.startTime;
        case "duration":
          const aDuration = (a.endTime || Date.now()) - a.startTime;
          const bDuration = (b.endTime || Date.now()) - b.startTime;
          return bDuration - aDuration;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const handleSessionToggle = (session: WorkSession, isSelected: boolean) => {
    if (isSelected) {
      onSelectionChange([...selectedSessions, session]);
    } else {
      onSelectionChange(selectedSessions.filter(s => s.id !== session.id));
    }
  };

  const handleSelectAll = () => {
    const filteredSessions = getFilteredSessions();
    const allSelected = filteredSessions.every(session =>
      selectedSessions.some(selected => selected.id === session.id)
    );

    if (allSelected) {
      // Deselect all filtered sessions
      const remainingSessions = selectedSessions.filter(selected =>
        !filteredSessions.some(filtered => filtered.id === selected.id)
      );
      onSelectionChange(remainingSessions);
    } else {
      // Select all filtered sessions
      const newSelections = filteredSessions.filter(session =>
        !selectedSessions.some(selected => selected.id === session.id)
      );
      onSelectionChange([...selectedSessions, ...newSelections]);
    }
  };

  const filteredSessions = getFilteredSessions();
  const allFilteredSelected = filteredSessions.length > 0 && filteredSessions.every(session =>
    selectedSessions.some(selected => selected.id === session.id)
  );

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Available Sessions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              placeholder="Search sessions..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              startContent={
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              label="Sort by"
              selectedKeys={[sortBy]}
              onSelectionChange={(keys) => setSortBy(Array.from(keys)[0] as string)}
            >
              <SelectItem key="date">Date (Newest First)</SelectItem>
              <SelectItem key="duration">Duration (Longest First)</SelectItem>
            </Select>
            <Select
              label="Filter by Status"
              selectedKeys={[filterStatus]}
              onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Sessions</SelectItem>
              <SelectItem key="completed">Completed Only</SelectItem>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="flat"
              size="sm"
              onPress={handleSelectAll}
            >
              {allFilteredSelected ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-gray-500">
              {selectedSessions.length} of {filteredSessions.length} sessions selected
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Session List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSessions.map((session) => {
          const isSelected = selectedSessions.some(s => s.id === session.id);
          
          return (
            <Card
              key={session.id}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? "ring-2 ring-primary bg-primary-50 dark:bg-primary-900/20" 
                  : "hover:shadow-md"
              }`}
              isPressable
              onPress={() => handleSessionToggle(session, !isSelected)}
            >
              <CardBody>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    isSelected={isSelected}
                    onValueChange={(checked) => handleSessionToggle(session, checked)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">
                        Session {session.id.slice(-4)}
                      </h4>
                      <Chip
                        color={session.status === "completed" ? "success" : "default"}
                        size="sm"
                        variant="flat"
                      >
                        {session.status.toUpperCase()}
                      </Chip>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div>Started: {formatDate(session.startTime)}</div>
                      <div>Duration: {formatDuration(session.startTime, session.endTime)}</div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {session.captureConfig.captureScreen && (
                        <Chip size="sm" variant="flat" color="primary">Screen</Chip>
                      )}
                      {session.captureConfig.captureKeystrokes && (
                        <Chip size="sm" variant="flat" color="secondary">Keys</Chip>
                      )}
                      {session.captureConfig.captureMouse && (
                        <Chip size="sm" variant="flat" color="success">Mouse</Chip>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {filteredSessions.length === 0 && (
        <Card>
          <CardBody className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No sessions found matching your criteria</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}