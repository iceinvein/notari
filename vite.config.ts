import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tsconfigPaths(), tailwindcss()],
	server: {
		port: 5173,
		strictPort: false,
		watch: {
			// 3. tell vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
	},
	// Tauri expects a fixed port, fail if that port is not available
	clearScreen: false,
	// 2. tauri expects a build directory
	build: {
		outDir: "dist",
		rollupOptions: {
			output: {
				manualChunks: (path) => {
					const reversedPath = path.split("/").reverse();
					return reversedPath[reversedPath.indexOf("node_modules") - 1];
				},
			},
			onwarn(warning, warn) {
				if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
				warn(warning);
			},
		},
		chunkSizeWarningLimit: 1600,
	},
});
