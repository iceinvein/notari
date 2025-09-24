// User management types
import type { DeviceKey } from "./crypto.types";

export type SubscriptionTier = "free" | "basic" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  subscription: SubscriptionInfo;
  deviceKeys: DeviceKey[];
  preferences: UserPreferences;
  organizationId?: string;
  createdAt: number;
  lastActive: number;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: "active" | "expired" | "cancelled" | "trial";
  expiresAt?: number;
  proofPacksRemaining: number;
  proofPacksUsed: number;
  features: string[];
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  uiStyle: "gen-z" | "professional";
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  capture: CapturePreferences;
}

export interface NotificationSettings {
  sessionComplete: boolean;
  verificationResults: boolean;
  subscriptionUpdates: boolean;
  securityAlerts: boolean;
}

export interface PrivacySettings {
  shareAnalytics: boolean;
  allowTelemetry: boolean;
  autoRedactSensitive: boolean;
  defaultPrivacyLevel: "minimal" | "balanced" | "maximum";
}

export interface CapturePreferences {
  defaultQuality: "low" | "medium" | "high";
  autoStart: boolean;
  pauseOnIdle: boolean;
  idleTimeout: number;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  domain: string;
  settings: OrganizationSettings;
  members: OrganizationMember[];
}

export interface OrganizationSettings {
  ssoEnabled: boolean;
  requiredVerificationLevel: "basic" | "enhanced" | "maximum";
  allowPersonalUse: boolean;
  dataRetentionDays: number;
}

export interface OrganizationMember {
  userId: string;
  role: "admin" | "manager" | "member";
  joinedAt: number;
  permissions: string[];
}
