import React, { createContext, useContext, useState, ReactNode } from "react";
import { SessionInputAnalysisType, SessionInputSkillLevel, SessionInputDominantHand } from "@workspace/api-client-react";

export interface SessionConfig {
  sessionId: string | null;
  athleteName: string;
  analysisType: SessionInputAnalysisType;
  skillLevel: SessionInputSkillLevel;
  dominantHand: SessionInputDominantHand;
  poseProcessor: "local" | "npu";
}

interface SessionContextType {
  config: SessionConfig;
  setConfig: (config: Partial<SessionConfig>) => void;
  resetConfig: () => void;
}

const defaultConfig: SessionConfig = {
  sessionId: null,
  athleteName: "",
  analysisType: "bowling",
  skillLevel: "intermediate",
  dominantHand: "right",
  poseProcessor: "local",
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<SessionConfig>(defaultConfig);

  const setConfig = (newConfig: Partial<SessionConfig>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
  };

  const resetConfig = () => {
    setConfigState(defaultConfig);
  };

  return (
    <SessionContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}
