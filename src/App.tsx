import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import Popover from "@/components/Popover";
import { ThemeProvider } from "@/components/ThemeProvider";
import { queryClient } from "@/lib/queryClient";

function App() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<HeroUIProvider>
						<div className="w-full h-screen">
							<Popover />
						</div>
					</HeroUIProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}

export default App;
