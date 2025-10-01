import RecordingsLibrary from "../RecordingsLibrary";

type RecordedVideosTabProps = {
	onSettings?: () => void;
};

export default function RecordedVideosTab({ onSettings }: RecordedVideosTabProps = {}) {
	return (
		<div className="h-full overflow-auto">
			<RecordingsLibrary onSettings={onSettings} />
		</div>
	);
}
