import { ReactNode } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Tabs,
  Tab,
} from "@heroui/react";
import type { AppView } from "../../App";

interface MainLayoutProps {
  children: ReactNode;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export function MainLayout({ children, currentView, onViewChange }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar isBordered className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <NavbarBrand>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Notari
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Proof-of-Work System
              </p>
            </div>
          </div>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <Tabs
            selectedKey={currentView}
            onSelectionChange={(key) => onViewChange(key as AppView)}
            variant="underlined"
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary"
            }}
          >
            <Tab
              key="sessions"
              title={
                <div className="flex items-center space-x-2">
                  <span>📹</span>
                  <span>Sessions</span>
                </div>
              }
            />
            <Tab
              key="proofpacks"
              title={
                <div className="flex items-center space-x-2">
                  <span>📦</span>
                  <span>Proof Packs</span>
                </div>
              }
            />
            <Tab
              key="redaction"
              title={
                <div className="flex items-center space-x-2">
                  <span>🔒</span>
                  <span>Redaction</span>
                </div>
              }
            />
            <Tab
              key="verification"
              title={
                <div className="flex items-center space-x-2">
                  <span>✅</span>
                  <span>Verification</span>
                </div>
              }
            />
          </Tabs>
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <Button
              variant="flat"
              size="sm"
              className="text-gray-600 dark:text-gray-300"
            >
              Settings
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </main>
    </div>
  );
}