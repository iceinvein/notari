import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

type TagInputProps = {
	value: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
	suggestions?: string[];
	label?: string;
	size?: "sm" | "md" | "lg";
};

export function TagInput({
	value,
	onChange,
	placeholder = "Type and press Enter...",
	suggestions = [],
	label,
	size = "sm",
}: TagInputProps) {
	const [inputValue, setInputValue] = useState("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter suggestions based on input
	const filteredSuggestions = suggestions.filter(
		(suggestion) =>
			suggestion.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(suggestion)
	);

	const addTag = (tag: string) => {
		const trimmedTag = tag.trim();
		if (trimmedTag && !value.includes(trimmedTag)) {
			onChange([...value, trimmedTag]);
			setInputValue("");
			setShowSuggestions(false);
		}
	};

	const removeTag = (tagToRemove: string) => {
		onChange(value.filter((tag) => tag !== tagToRemove));
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && inputValue.trim()) {
			e.preventDefault();
			addTag(inputValue);
		} else if (e.key === "Backspace" && !inputValue && value.length > 0) {
			// Remove last tag on backspace if input is empty
			removeTag(value[value.length - 1]);
		} else if (e.key === "Escape") {
			setShowSuggestions(false);
		}
	};

	return (
		<div className="space-y-2">
			<div className="relative">
				<Input
					ref={inputRef}
					size={size}
					label={label}
					placeholder={placeholder}
					value={inputValue}
					onValueChange={(val) => {
						setInputValue(val);
						setShowSuggestions(val.length > 0 && filteredSuggestions.length > 0);
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => {
						if (inputValue && filteredSuggestions.length > 0) {
							setShowSuggestions(true);
						}
					}}
					onBlur={() => {
						// Delay to allow clicking on suggestions
						setTimeout(() => setShowSuggestions(false), 200);
					}}
				/>

				{/* Suggestions dropdown */}
				{showSuggestions && filteredSuggestions.length > 0 && (
					<div className="absolute z-50 w-full mt-1 bg-content1 border border-divider rounded-lg shadow-lg max-h-48 overflow-y-auto">
						{filteredSuggestions.map((suggestion) => (
							<button
								key={suggestion}
								type="button"
								className="w-full px-3 py-2 text-left text-sm hover:bg-default-100 transition-colors"
								onClick={() => addTag(suggestion)}
							>
								{suggestion}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Tags display below input */}
			{value.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{value.map((tag) => (
						<Chip
							key={tag}
							size="sm"
							variant="flat"
							color="primary"
							endContent={
								<button
									type="button"
									className="ml-1"
									onClick={() => removeTag(tag)}
									aria-label={`Remove ${tag}`}
								>
									<X className="w-3 h-3" />
								</button>
							}
						>
							{tag}
						</Chip>
					))}
				</div>
			)}
		</div>
	);
}
