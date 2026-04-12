"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
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
// Shared row content (used in both sortable rows and the drag overlay)
// ---------------------------------------------------------------------------

function RowContent({
  player,
  rank,
  total,
  onMoveUp,
  onMoveDown,
  disabled,
  isOverlay,
}: {
  player: Player;
  rank: number;
  total: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disabled?: boolean;
  isOverlay?: boolean;
}) {
  return (
    <>
      <GripVertical className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
      <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
        {rank}
      </span>
      <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {player.displayName}
      </span>
      {!isOverlay && (
        <div className="flex shrink-0 gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMoveUp}
            disabled={disabled || rank === 1}
            aria-label={`הזז ${player.displayName} למעלה`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMoveDown}
            disabled={disabled || rank === total}
            aria-label={`הזז ${player.displayName} למטה`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sortable row — shows as a faded placeholder while its overlay is dragging
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`flex touch-none cursor-grab items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm active:cursor-grabbing dark:bg-zinc-900
        ${isDragging
          ? "border-zinc-200 opacity-0 dark:border-zinc-700"
          : "border-zinc-200 dark:border-zinc-700"
        }`}
    >
      <RowContent
        player={player}
        rank={rank}
        total={total}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        disabled={disabled}
      />
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
  const initialOrder: string[] = existingOrder
    ? existingOrder.filter((id) => players.some((p) => p.id === id))
    : players.map((p) => p.id);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const playerById = new Map(players.map((p) => [p.id, p]));

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
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
      if (result && !result.ok) {
        setError(result.message ?? "שגיאה בשמירה");
      }
    });
  }

  const isResubmit = existingOrder !== null;
  const activePlayer = activeId ? playerById.get(activeId) : null;
  const activeRank = activeId ? order.indexOf(activeId) + 1 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          שאלון דירוג שחקנים — {year}
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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
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

        {/* Floating overlay — renders above everything while dragging */}
        <DragOverlay>
          {activePlayer ? (
            <div className="flex cursor-grabbing items-center gap-3 rounded-xl border border-blue-400 bg-white px-3 py-2.5 shadow-2xl dark:bg-zinc-900">
              <RowContent
                player={activePlayer}
                rank={activeRank}
                total={order.length}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? "שומר…" : isResubmit ? "עדכן" : "שלח"}
      </button>
    </div>
  );
}
