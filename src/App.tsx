import { HeroUIProvider } from "@heroui/react";
import Popover from "@/components/Popover";
import { ThemeProvider } from "@/components/ThemeProvider";

function App() {
	return (
		<ThemeProvider>
			<HeroUIProvider>
				<div className="w-full h-screen">
					<Popover />
				</div>
			</HeroUIProvider>
		</ThemeProvider>
	);
}

export default App;
