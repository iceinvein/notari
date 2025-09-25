import { HeroUIProvider } from "@heroui/react";
import { AppModeProvider } from "./contexts/AppModeContext";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <AppModeProvider>{children}</AppModeProvider>
    </HeroUIProvider>
  );
}
