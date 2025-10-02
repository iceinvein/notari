import { describe, expect, it } from "vitest";

/**
 * Example utility functions to test
 * These would be in src/utils/format.ts
 */

function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(date: Date): string {
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

describe("formatBytes", () => {
	it("should format 0 bytes", () => {
		expect(formatBytes(0)).toBe("0 Bytes");
	});

	it("should format bytes", () => {
		expect(formatBytes(500)).toBe("500 Bytes");
	});

	it("should format kilobytes", () => {
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1536)).toBe("1.5 KB");
	});

	it("should format megabytes", () => {
		expect(formatBytes(1048576)).toBe("1 MB");
		expect(formatBytes(5242880)).toBe("5 MB");
	});

	it("should format gigabytes", () => {
		expect(formatBytes(1073741824)).toBe("1 GB");
	});

	it("should respect decimal places", () => {
		expect(formatBytes(1536, 0)).toBe("2 KB");
		expect(formatBytes(1536, 1)).toBe("1.5 KB");
		expect(formatBytes(1536, 3)).toBe("1.5 KB");
	});
});

describe("formatDuration", () => {
	it("should format seconds only", () => {
		expect(formatDuration(30)).toBe("0:30");
		expect(formatDuration(5)).toBe("0:05");
	});

	it("should format minutes and seconds", () => {
		expect(formatDuration(90)).toBe("1:30");
		expect(formatDuration(125)).toBe("2:05");
	});

	it("should format hours, minutes, and seconds", () => {
		expect(formatDuration(3661)).toBe("1:01:01");
		expect(formatDuration(7200)).toBe("2:00:00");
	});

	it("should handle zero", () => {
		expect(formatDuration(0)).toBe("0:00");
	});
});

describe("formatTimestamp", () => {
	it("should format a date", () => {
		const date = new Date("2024-01-15T10:30:00");
		const formatted = formatTimestamp(date);

		// Check that it contains expected parts (exact format may vary by locale)
		expect(formatted).toContain("2024");
		expect(formatted).toContain("Jan");
		expect(formatted).toContain("15");
	});
});
