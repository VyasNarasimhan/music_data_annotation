import { formatTimestamp } from "../lib/youtube";

type Note = {
  timestamp: number | null;
  transcript: string;
  createdAt: string;
  overall?: boolean;
};

type Props = {
  notes: Note[];
  onDelete: (timestamp: number) => void;
  onJumpToTimestamp: (timestamp: number) => void;
};

export default function NotesList({ notes, onDelete, onJumpToTimestamp }: Props) {
  if (!notes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        No notes yet.
      </div>
    );
  }

  const overallNote = notes.find((note) => note.overall);
  const timestampedNotes = notes.filter((note) => !note.overall);

  return (
    <div className="space-y-3">
      {overallNote ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-slate-500">Overall Feedback</div>
          <p className="mt-2 text-sm text-slate-700">{overallNote.transcript}</p>
        </div>
      ) : null}
      {timestampedNotes.map((note, index) => (
        <NoteRow
          key={`${note.timestamp}-${index}`}
          note={note}
          onDelete={onDelete}
          onJumpToTimestamp={onJumpToTimestamp}
        />
      ))}
    </div>
  );
}

type RowProps = {
  note: Note;
  onDelete: (timestamp: number) => void;
  onJumpToTimestamp: (timestamp: number) => void;
};

function NoteRow({ note, onDelete, onJumpToTimestamp }: RowProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase text-slate-500">
          {formatTimestamp(note.timestamp)}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-slate-100 px-2 py-1 text-xs"
            onClick={() => onJumpToTimestamp(note.timestamp)}
          >
            Jump
          </button>
          <button
            className="rounded-md bg-red-500 px-2 py-1 text-xs text-white"
            onClick={() => onDelete(note.timestamp)}
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">{note.transcript}</p>
    </div>
  );
}
