"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Canvas, PencilBrush } from "fabric";
import RichTextEditor from "@/components/RichTextEditor";

const STORAGE_KEY = "soft-study-notes-v1";
const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 1600;

type DrawTool = "pen" | "highlighter" | "eraser";

type TableCell = {
  value: string;
  rowSpan: number;
  colSpan: number;
  hidden: boolean;
};

type TableData = {
  id: string;
  x: number;
  y: number;
  colWidths: number[];
  rowHeights: number[];
  cells: TableCell[][];
};

type NoteItem = {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  drawingJson: string | null;
  tables: TableData[];
  richText: string;
  richTextCharCount: number;
};

const now = () => Date.now();

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createCell = (): TableCell => ({
  value: "",
  rowSpan: 1,
  colSpan: 1,
  hidden: false,
});

const createTable = (): TableData => {
  const rows = 4;
  const cols = 4;
  return {
    id: makeId(),
    x: 120,
    y: 120,
    colWidths: Array.from({ length: cols }, () => 120),
    rowHeights: Array.from({ length: rows }, () => 42),
    cells: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => createCell())
    ),
  };
};

const createNote = (index: number): NoteItem => ({
  id: makeId(),
  title: `新しいノート ${index + 1}`,
  folder: "未分類",
  tags: [],
  createdAt: now(),
  updatedAt: now(),
  drawingJson: null,
  tables: [],
  richText: "<p></p>",
  richTextCharCount: 0,
});

const normalizeNote = (rawNote: Partial<NoteItem>, index: number): NoteItem => {
  const base = createNote(index);
  return {
    ...base,
    ...rawNote,
    tags: Array.isArray(rawNote.tags) ? rawNote.tags : [],
    tables: Array.isArray(rawNote.tables) ? rawNote.tables : [],
    richText:
      typeof rawNote.richText === "string" ? rawNote.richText : "<p></p>",
    richTextCharCount:
      typeof rawNote.richTextCharCount === "number" ? rawNote.richTextCharCount : 0,
  };
};

const SortableNoteCard = ({
  note,
  active,
  onSelect,
}: {
  note: NoteItem;
  active: boolean;
  onSelect: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-[var(--ui-button)] bg-[var(--ui-hover)]"
          : "border-[var(--ui-line)] bg-white hover:bg-[var(--ui-hover)]"
      }`}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-main)]">
            {note.title || "無題"}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-main)]">
            {note.folder}
          </p>
        </div>
        <span
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs"
          {...attributes}
          {...listeners}
          aria-label="ノートを並び替え"
        >
          並替
        </span>
      </div>
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={`${note.id}-${tag}`}
              className="rounded-full border border-[var(--ui-line)] px-2 py-0.5 text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

const PwaRegistrar = () => {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
};

type TableSelection = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

const TableBlock = ({
  table,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  table: TableData;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: TableData) => void;
  onDelete: () => void;
}) => {
  const [selection, setSelection] = useState<TableSelection | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(
    null
  );
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const tableWidth = table.colWidths.reduce((acc, cur) => acc + cur, 0);

  const tableHeight = table.rowHeights.reduce((acc, cur) => acc + cur, 0);

  const moveTable = (left: number, top: number) => {
    onChange({
      ...table,
      x: Math.max(0, left),
      y: Math.max(0, top),
    });
  };

  const resizeTable = (nextWidth: number, nextHeight: number) => {
    const safeWidth = Math.max(240, nextWidth);
    const safeHeight = Math.max(120, nextHeight);
    const widthRatio = safeWidth / tableWidth;
    const heightRatio = safeHeight / tableHeight;
    onChange({
      ...table,
      colWidths: table.colWidths.map((w) => Math.max(80, Math.round(w * widthRatio))),
      rowHeights: table.rowHeights.map((h) => Math.max(34, Math.round(h * heightRatio))),
    });
  };

  const setCellValue = (row: number, col: number, value: string) => {
    const next = structuredClone(table);
    next.cells[row][col].value = value;
    onChange(next);
  };

  const mergeSelected = () => {
    if (!selection) return;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    if (minRow === maxRow && minCol === maxCol) return;

    const next = structuredClone(table);
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        if (next.cells[r][c].hidden) return;
      }
    }
    next.cells[minRow][minCol].rowSpan = maxRow - minRow + 1;
    next.cells[minRow][minCol].colSpan = maxCol - minCol + 1;

    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        if (r === minRow && c === minCol) continue;
        next.cells[r][c].hidden = true;
      }
    }

    onChange(next);
  };

  const splitSelected = () => {
    if (!selection) return;
    const row = selection.startRow;
    const col = selection.startCol;
    const root = table.cells[row][col];
    if (root.rowSpan === 1 && root.colSpan === 1) return;

    const next = structuredClone(table);
    for (let r = row; r < row + root.rowSpan; r += 1) {
      for (let c = col; c < col + root.colSpan; c += 1) {
        next.cells[r][c].hidden = false;
        next.cells[r][c].rowSpan = 1;
        next.cells[r][c].colSpan = 1;
      }
    }
    onChange(next);
  };

  const addRow = () => {
    const next = structuredClone(table);
    next.cells.push(Array.from({ length: next.colWidths.length }, () => createCell()));
    next.rowHeights.push(42);
    onChange(next);
  };

  const addCol = () => {
    const next = structuredClone(table);
    next.cells.forEach((row) => row.push(createCell()));
    next.colWidths.push(120);
    onChange(next);
  };

  const removeRow = () => {
    if (table.cells.length <= 1) return;
    const next = structuredClone(table);
    next.cells.pop();
    next.rowHeights.pop();
    onChange(next);
  };

  const removeCol = () => {
    if (table.colWidths.length <= 1) return;
    const next = structuredClone(table);
    next.cells.forEach((row) => row.pop());
    next.colWidths.pop();
    onChange(next);
  };

  const onCopy = async () => {
    if (!selection) return;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    const text = Array.from({ length: maxRow - minRow + 1 }, (_, rOff) =>
      Array.from({ length: maxCol - minCol + 1 }, (_, cOff) => {
        const cell = table.cells[minRow + rOff][minCol + cOff];
        return cell.hidden ? "" : cell.value;
      }).join("\t")
    ).join("\n");
    await navigator.clipboard.writeText(text);
  };

  const onPaste = async () => {
    if (!selection) return;
    const pasted = await navigator.clipboard.readText();
    if (!pasted) return;
    const lines = pasted.split("\n").map((line) => line.split("\t"));
    const next = structuredClone(table);
    lines.forEach((line, rOff) => {
      line.forEach((value, cOff) => {
        const row = selection.startRow + rOff;
        const col = selection.startCol + cOff;
        if (next.cells[row]?.[col] && !next.cells[row][col].hidden) {
          next.cells[row][col].value = value;
        }
      });
    });
    onChange(next);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect();
      }}
      className={`absolute rounded-2xl border bg-white p-2 shadow-sm ${
        selected ? "border-[var(--ui-button)]" : "border-[var(--ui-line)]"
      }`}
      style={{ left: table.x, top: table.y }}
    >
      <div
        className="mb-2 flex cursor-move items-center justify-between rounded-xl bg-[var(--ui-hover)] p-2"
        onPointerDown={(event) => {
          event.stopPropagation();
          dragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            left: table.x,
            top: table.y,
          };
          const onMove = (moveEvent: PointerEvent) => {
            if (!dragStartRef.current) return;
            const dx = moveEvent.clientX - dragStartRef.current.x;
            const dy = moveEvent.clientY - dragStartRef.current.y;
            moveTable(dragStartRef.current.left + dx, dragStartRef.current.top + dy);
          };
          const onUp = () => {
            dragStartRef.current = null;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        <span className="text-xs font-semibold">表ブロック</span>
        <span className="text-xs">ドラッグで移動</span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            mergeSelected();
          }}
        >
          結合
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            splitSelected();
          }}
        >
          分割
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            addRow();
          }}
        >
          +行
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            addCol();
          }}
        >
          +列
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            removeRow();
          }}
        >
          -行
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            removeCol();
          }}
        >
          -列
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            void onCopy();
          }}
        >
          コピー
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            void onPaste();
          }}
        >
          貼付
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--ui-button)] px-2 py-1 text-xs hover:bg-[var(--ui-hover)]"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          削除
        </button>
      </div>

      <table
        className="border-collapse border border-[var(--ui-line)]"
        style={{ width: tableWidth, height: tableHeight }}
      >
        <tbody>
          {table.cells.map((row, rowIndex) => (
            <tr key={`${table.id}-r-${rowIndex}`} style={{ height: table.rowHeights[rowIndex] }}>
              {row.map((cell, colIndex) => {
                if (cell.hidden) return null;
                const selectedCell =
                  selection &&
                  rowIndex >= Math.min(selection.startRow, selection.endRow) &&
                  rowIndex <= Math.max(selection.startRow, selection.endRow) &&
                  colIndex >= Math.min(selection.startCol, selection.endCol) &&
                  colIndex <= Math.max(selection.startCol, selection.endCol);
                return (
                  <td
                    key={`${table.id}-${rowIndex}-${colIndex}`}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    className={`border border-[var(--ui-line)] p-0 ${selectedCell ? "bg-[var(--ui-hover)]" : "bg-white"}`}
                    style={{ width: table.colWidths[colIndex] }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setSelection({
                        startRow: rowIndex,
                        startCol: colIndex,
                        endRow: rowIndex,
                        endCol: colIndex,
                      });
                    }}
                    onMouseEnter={(event) => {
                      if (!selection) return;
                      if (event.buttons !== 1) return;
                      setSelection((prev) =>
                        prev
                          ? {
                              ...prev,
                              endRow: rowIndex,
                              endCol: colIndex,
                            }
                          : prev
                      );
                    }}
                  >
                    <textarea
                      value={cell.value}
                      onChange={(event) =>
                        setCellValue(rowIndex, colIndex, event.target.value)
                      }
                      className="h-full min-h-10 w-full resize-none bg-transparent p-2 text-sm outline-none"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[var(--ui-button)] text-xs"
        onPointerDown={(event) => {
          event.stopPropagation();
          resizeStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            width: tableWidth,
            height: tableHeight,
          };
          const onMove = (moveEvent: PointerEvent) => {
            if (!resizeStartRef.current) return;
            const dx = moveEvent.clientX - resizeStartRef.current.x;
            const dy = moveEvent.clientY - resizeStartRef.current.y;
            resizeTable(
              resizeStartRef.current.width + dx,
              resizeStartRef.current.height + dy
            );
          };
          const onUp = () => {
            resizeStartRef.current = null;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        ↘
      </button>
    </div>
  );
};

export default function Home() {
  const [notes, setNotes] = useState<NoteItem[]>(() => [createNote(0)]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState<DrawTool>("pen");
  const [zoom, setZoom] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("未同期");
  const [editorMode, setEditorMode] = useState<"text" | "canvas">("canvas");
  const [mobilePane, setMobilePane] = useState<"notes" | "editor">("editor");

  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = [createNote(0)];
      setNotes(initial);
      setActiveNoteId(initial[0].id);
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as NoteItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = [createNote(0)];
        setNotes(initial);
        setActiveNoteId(initial[0].id);
      } else {
        const normalized = parsed.map((note, index) => normalizeNote(note, index));
        setNotes(normalized);
        setActiveNoteId(normalized[0].id);
      }
    } catch {
      const initial = [createNote(0)];
      setNotes(initial);
      setActiveNoteId(initial[0].id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes, hydrated]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? notes[0],
    [notes, activeNoteId]
  );

  useEffect(() => {
    if (!activeNote && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [activeNote, notes]);

  const updateNote = useCallback((noteId: string, patch: Partial<NoteItem>) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, ...patch, updatedAt: now() } : note
      )
    );
  }, []);

  useEffect(() => {
    const canvasElement = canvasElementRef.current;
    if (!canvasElement) return;

    const canvas = new Canvas(canvasElement, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      isDrawingMode: true,
      selection: false,
    });
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 3;
    canvas.freeDrawingBrush.color = "#4B454D";

    const onPathCreated = () => {
      const current = activeNoteId;
      if (!current) return;
      updateNote(current, { drawingJson: JSON.stringify(canvas.toJSON()) });
    };

    canvas.on("path:created", onPathCreated);
    fabricRef.current = canvas;

    return () => {
      canvas.off("path:created", onPathCreated);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [activeNoteId, updateNote]);

  useEffect(() => {
    if (!fabricRef.current || !activeNote) return;
    if (!activeNote.drawingJson) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = "transparent";
      fabricRef.current.renderAll();
      return;
    }
    fabricRef.current.loadFromJSON(activeNote.drawingJson, () => {
      fabricRef.current?.renderAll();
    });
  }, [activeNote]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const brush = canvas.freeDrawingBrush as PencilBrush;
    if (tool === "pen") {
      brush.color = "#4B454D";
      brush.width = 3;
    } else if (tool === "highlighter") {
      brush.color = "rgba(229,182,232,0.45)";
      brush.width = 16;
    } else {
      brush.color = "#FFFFFF";
      brush.width = 24;
    }
  }, [tool]);

  const filteredNotes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter((note) => {
      const target = `${note.title} ${note.folder} ${note.tags.join(" ")}`.toLowerCase();
      return target.includes(normalized);
    });
  }, [notes, search]);

  const folders = useMemo(
    () => Array.from(new Set(notes.map((note) => note.folder))).filter(Boolean),
    [notes]
  );

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setNotes((prev) => {
      const oldIndex = prev.findIndex((note) => note.id === active.id);
      const newIndex = prev.findIndex((note) => note.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const addNewNote = () => {
    setNotes((prev) => {
      const created = createNote(prev.length);
      setActiveNoteId(created.id);
      return [created, ...prev];
    });
  };

  const addTableToActive = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { tables: [...activeNote.tables, createTable()] });
  };

  const updateTable = (tableId: string, next: TableData) => {
    if (!activeNote) return;
    updateNote(activeNote.id, {
      tables: activeNote.tables.map((table) => (table.id === tableId ? next : table)),
    });
  };

  const deleteTable = (tableId: string) => {
    if (!activeNote) return;
    updateNote(activeNote.id, {
      tables: activeNote.tables.filter((table) => table.id !== tableId),
    });
    setSelectedTableId((prev) => (prev === tableId ? null : prev));
  };

  const saveToCloud = async () => {
    try {
      setCloudStatus("同期中...");
      const response = await fetch("/api/cloud", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        throw new Error("同期失敗");
      }
      setCloudStatus("クラウド保存済み");
    } catch {
      setCloudStatus("同期エラー");
    }
  };

  const loadFromCloud = async () => {
    try {
      setCloudStatus("読込中...");
      const response = await fetch("/api/cloud", { method: "GET" });
      if (!response.ok) {
        throw new Error("読込失敗");
      }
      const payload = (await response.json()) as { notes?: Partial<NoteItem>[] };
      if (!Array.isArray(payload.notes) || payload.notes.length === 0) {
        setCloudStatus("クラウドデータなし");
        return;
      }
      const normalized = payload.notes.map((note, index) => normalizeNote(note, index));
      setNotes(normalized);
      setActiveNoteId(normalized[0].id);
      setCloudStatus("クラウド読込済み");
    } catch {
      setCloudStatus("読込エラー");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] text-[var(--text-main)]">
      <PwaRegistrar />
      <main className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col lg:flex-row">
        <div className="flex items-center gap-2 border-b border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobilePane("editor")}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold ${
              mobilePane === "editor"
                ? "bg-[var(--ui-button)]"
                : "border border-[var(--ui-line)] bg-white"
            }`}
          >
            編集画面
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("notes")}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold ${
              mobilePane === "notes"
                ? "bg-[var(--ui-button)]"
                : "border border-[var(--ui-line)] bg-white"
            }`}
          >
            ノート一覧
          </button>
        </div>

        <aside
          className={`soft-scroll w-full shrink-0 border-b border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-4 lg:h-screen lg:w-[320px] lg:overflow-y-auto lg:border-b-0 lg:border-r ${
            mobilePane === "notes" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Soft Study Notes</h1>
            <button
              type="button"
              onClick={addNewNote}
              className="rounded-2xl bg-[var(--ui-button)] px-4 py-2 text-sm font-semibold hover:bg-[var(--ui-hover)]"
            >
              + ノート作成
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="検索（タイトル/フォルダ/タグ）"
            className="mb-3 w-full rounded-2xl border border-[var(--ui-line)] bg-white px-3 py-2 text-sm outline-none"
          />

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void saveToCloud();
              }}
              className="flex-1 rounded-2xl bg-[var(--ui-button)] px-3 py-2 text-xs font-semibold hover:bg-[var(--ui-hover)]"
            >
              クラウド保存
            </button>
            <button
              type="button"
              onClick={() => {
                void loadFromCloud();
              }}
              className="flex-1 rounded-2xl border border-[var(--ui-line)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--ui-hover)]"
            >
              クラウド読込
            </button>
          </div>
          <p className="mb-3 text-xs">同期状態: {cloudStatus}</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={filteredNotes.map((note) => note.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredNotes.map((note) => (
                  <SortableNoteCard
                    key={note.id}
                    note={note}
                    active={activeNote?.id === note.id}
                    onSelect={() => {
                      setActiveNoteId(note.id);
                      setMobilePane("editor");
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        <section
          className={`min-h-[70vh] flex-1 flex-col p-4 sm:p-5 lg:flex ${
            mobilePane === "editor" ? "flex" : "hidden lg:flex"
          }`}
        >
          {activeNote ? (
            <>
              <div className="mb-3 rounded-3xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    value={activeNote.title}
                    onChange={(event) =>
                      updateNote(activeNote.id, { title: event.target.value })
                    }
                    className="min-w-44 flex-1 rounded-2xl border border-[var(--ui-line)] bg-white px-3 py-2 text-base font-semibold outline-none"
                    placeholder="ノートタイトル"
                  />
                  <select
                    value={activeNote.folder}
                    onChange={(event) =>
                      updateNote(activeNote.id, { folder: event.target.value })
                    }
                    className="rounded-2xl border border-[var(--ui-line)] bg-white px-3 py-2 text-sm"
                  >
                    {folders.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                    {!folders.includes("未分類") && <option value="未分類">未分類</option>}
                    <option value="学習">学習</option>
                    <option value="日常">日常</option>
                    <option value="レシピ">レシピ</option>
                  </select>
                  <input
                    value={activeNote.tags.join(",")}
                    onChange={(event) =>
                      updateNote(activeNote.id, {
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="タグ（, 区切り）"
                    className="rounded-2xl border border-[var(--ui-line)] bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode("canvas")}
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      editorMode === "canvas"
                        ? "bg-[var(--ui-button)]"
                        : "bg-white border border-[var(--ui-line)]"
                    }`}
                  >
                    手書き＋表
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("text")}
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      editorMode === "text"
                        ? "bg-[var(--ui-button)]"
                        : "bg-white border border-[var(--ui-line)]"
                    }`}
                  >
                    テキスト
                  </button>

                  {editorMode === "canvas" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setTool("pen")}
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          tool === "pen"
                            ? "bg-[var(--ui-button)]"
                            : "bg-white border border-[var(--ui-line)]"
                        }`}
                      >
                        ペン
                      </button>
                      <button
                        type="button"
                        onClick={() => setTool("highlighter")}
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          tool === "highlighter"
                            ? "bg-[var(--ui-button)]"
                            : "bg-white border border-[var(--ui-line)]"
                        }`}
                      >
                        蛍光ペン
                      </button>
                      <button
                        type="button"
                        onClick={() => setTool("eraser")}
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          tool === "eraser"
                            ? "bg-[var(--ui-button)]"
                            : "bg-white border border-[var(--ui-line)]"
                        }`}
                      >
                        消しゴム
                      </button>

                      <button
                        type="button"
                        onClick={addTableToActive}
                        className="rounded-2xl bg-[var(--ui-button)] px-4 py-2 text-sm hover:bg-[var(--ui-hover)]"
                      >
                        + 表を追加
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setZoom((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(1))))
                        }
                        className="rounded-2xl bg-[var(--ui-button)] px-4 py-2 text-sm hover:bg-[var(--ui-hover)]"
                      >
                        縮小
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setZoom((prev) => Math.min(1.8, Number((prev + 0.1).toFixed(1))))
                        }
                        className="rounded-2xl bg-[var(--ui-button)] px-4 py-2 text-sm hover:bg-[var(--ui-hover)]"
                      >
                        拡大
                      </button>
                      <span className="self-center text-sm">{Math.round(zoom * 100)}%</span>
                    </>
                  )}

                  <span className="self-center text-sm">
                    文字数: {activeNote.richTextCharCount}
                  </span>
                </div>
              </div>

              {editorMode === "text" ? (
                <div className="mb-3">
                  <RichTextEditor
                    content={activeNote.richText}
                    onChange={(html, count) => {
                      updateNote(activeNote.id, {
                        richText: html,
                        richTextCharCount: count,
                      });
                    }}
                  />
                </div>
              ) : (
                <div className="soft-scroll flex-1 overflow-auto rounded-3xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-4">
                  <div
                    style={{ width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
                    className="relative"
                  >
                    <div
                      className="line-paper absolute left-0 top-0 overflow-hidden rounded-2xl border border-[var(--ui-line)]"
                      style={{
                        width: PAGE_WIDTH,
                        height: PAGE_HEIGHT,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <canvas ref={canvasElementRef} className="absolute left-0 top-0" />
                      <div className="absolute inset-0">
                        {activeNote.tables.map((table) => (
                          <TableBlock
                            key={table.id}
                            table={table}
                            selected={selectedTableId === table.id}
                            onSelect={() => setSelectedTableId(table.id)}
                            onChange={(next) => updateTable(table.id, next)}
                            onDelete={() => deleteTable(table.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-8 text-center text-sm">
              ノートを作成すると編集できます。
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
