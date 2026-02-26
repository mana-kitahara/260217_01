"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type AppItem = {
  id: string;
  name: string;
  icon: string;
  href: string;
  description: string;
};

const APP_ORDER_KEY = "soft-study-app-order-v1";

const APP_CATALOG: AppItem[] = [
  {
    id: "notes",
    name: "ノートアプリ",
    icon: "📝",
    href: "/notes",
    description: "手書き・表・テキスト編集",
  },
];

const SortableAppCard = ({ app }: { app: AppItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: app.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Link
        href={app.href}
        className="group flex min-h-36 w-full flex-col justify-between rounded-3xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-5 shadow-sm transition hover:bg-[var(--ui-hover)] active:scale-[0.99] sm:min-h-40 sm:p-6"
      >
        <div>
          <p className="text-3xl sm:text-4xl" aria-hidden>
            {app.icon}
          </p>
          <p className="mt-3 text-lg font-semibold text-[var(--text-main)]">{app.name}</p>
          <p className="mt-1 text-sm text-[var(--text-main)]">{app.description}</p>
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">タップして起動</p>
      </Link>

      <button
        type="button"
        aria-label={`${app.name} を並び替え`}
        className="absolute right-3 top-3 rounded-xl bg-[var(--ui-hover)] px-2 py-1 text-xs text-[var(--text-main)]"
        {...attributes}
        {...listeners}
      >
        並替
      </button>
    </div>
  );
};

export default function Home() {
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    APP_CATALOG.map((app) => app.id)
  );

  useEffect(() => {
    const raw = localStorage.getItem(APP_ORDER_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const valid = parsed.filter((id) => APP_CATALOG.some((app) => app.id === id));
      const missing = APP_CATALOG.map((app) => app.id).filter((id) => !valid.includes(id));
      setOrderedIds([...valid, ...missing]);
    } catch {
      setOrderedIds(APP_CATALOG.map((app) => app.id));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_ORDER_KEY, JSON.stringify(orderedIds));
  }, [orderedIds]);

  const apps = useMemo(() => {
    return orderedIds
      .map((id) => APP_CATALOG.find((app) => app.id === id))
      .filter((app): app is AppItem => Boolean(app));
  }, [orderedIds]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedIds((prev) => {
      const oldIndex = prev.findIndex((id) => id === active.id);
      const newIndex = prev.findIndex((id) => id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] p-4 text-[var(--text-main)] sm:p-6">
      <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col justify-center sm:min-h-[calc(100vh-3rem)]">
        <header className="mx-auto mb-5 w-full max-w-4xl rounded-3xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] p-5 text-center shadow-sm sm:mb-6 sm:p-6">
          <h1 className="text-2xl font-bold sm:text-3xl">アプリ一覧</h1>
          <p className="mt-2 text-sm sm:text-base">
            使いたいアプリをタップして起動。ドラッグで並び替えできます。
          </p>
        </header>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={apps.map((app) => app.id)} strategy={rectSortingStrategy}>
            <section className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 justify-items-center sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <div key={app.id} className="w-full max-w-[340px]">
                  <SortableAppCard app={app} />
                </div>
              ))}
            </section>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}
