"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { submitPeerRatingAction } from "@/app/ranking/submit/actions";

type Player = { id: string; displayName: string };

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

function SortablePlayerRow({
  player,
  rank,
  total,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  player: Player;
  rank: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition dark:bg-zinc-900
        ${isDragging
          ? "border-blue-400 shadow-lg dark:border-blue-500"
          : "border-zinc-200 dark:border-zinc-700"
        }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="גרור לסידור מחדש"
        className="cursor-grab touch-none text-zinc-300 hover:text-zinc-500 disabled:cursor-default dark:text-zinc-600 dark:hover:text-zinc-400"
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>

      {/* Rank number */}
      <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
        {rank}
      </span>

      {/* Player name */}
      <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {player.displayName}
      </span>

      {/* Up / Down buttons */}
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={disabled || rank === 1}
          aria-label={`הזז ${player.displayName} למעלה`}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={onMoveDown}
          disabled={disabled || rank === total}
          aria-label={`הזז ${player.displayName} למטה`}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function PeerRatingForm({
  sessionId,
  year,
  players,
  existingOrder,
}: {
  sessionId: string;
  year: number;
  players: Player[];
  existingOrder: string[] | null;
}) {
  // Build initial order from existing submission or from default order
  const initialOrder: string[] = existingOrder
    ? existingOrder.filter((id) => players.some((p) => p.id === id))
    : players.map((p) => p.id);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const playerById = new Map(players.map((p) => [p.id, p]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const from = prev.indexOf(active.id as string);
        const to = prev.indexOf(over.id as string);
        return arrayMove(prev, from, to);
      });
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => arrayMove(prev, index, target));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitPeerRatingAction(sessionId, order);
      // If result is returned (not redirected), it's an error
      if (result && !result.ok) {
        setError(result.message ?? "שגיאה בשמירה");
      }
    });
  }

  const isResubmit = existingOrder !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          שאלון דירוג עמיתים — {year}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          סדר את השחקנים מהטוב ביותר (1) לחלש ביותר ({players.length}).
          ניתן לגרור, להשתמש בחצים, או לשניהם.
        </p>
        {isResubmit && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            כבר הגשת שאלון לשנה זו — הגשה חדשה תחליף את הקודמת.
          </p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {order.map((id, index) => {
              const player = playerById.get(id);
              if (!player) return null;
              return (
                <SortablePlayerRow
                  key={id}
                  player={player}
                  rank={index + 1}
                  total={order.length}
                  onMoveUp={() => moveItem(index, -1)}
                  onMoveDown={() => moveItem(index, 1)}
                  disabled={pending}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? "שומר…" : isResubmit ? "עדכן הגשה" : "שלח הגשה"}
      </button>
    </div>
  );
}
