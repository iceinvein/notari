import { HeroUIProvider } from "@heroui/react";
import Popover from "@/components/Popover";

function App() {
  return (
    <HeroUIProvider>
      <div className="w-full h-screen">
        <Popover />
      </div>
    </HeroUIProvider>
  );
}

export default App;
