import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { toaster } from "../components/ui/toaster";
import { clampColumnWidth, type TableLayout } from "../models/tableLayout";

type SaveState =
  | { status: "idle" | "saving" }
  | { status: "error"; message: string };

type Drag = {
  pointerId: number;
  index: number;
  startX: number;
  startWidth: number;
  before: number[];
};

export const useTableColumnResize = (
  layout: TableLayout,
  save: (id: string, widths: number[]) => Promise<TableLayout>,
) => {
  const [draft, setDraft] = useState<number[]>();
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const widths = draft ?? layout.columnWidths;
  const widthsRef = useRef(widths);
  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);
  const drag = useRef<Drag | undefined>(undefined);
  const version = useRef(0);

  const changeWidth = (index: number, width: number) => {
    const next = Array.from({ length: layout.columnCount }, (_, i) =>
      i === index ? width : (widthsRef.current[i] ?? 0),
    );
    widthsRef.current = next;
    setDraft(next);
    return next;
  };
  const persist = async (next: number[]) => {
    const request = ++version.current;
    setState({ status: "saving" });
    try {
      await save(layout.id, next);
      if (version.current === request) {
        setDraft(undefined);
        setState({ status: "idle" });
      }
    } catch (error) {
      if (version.current === request) {
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: "error", message });
        toaster.create({
          type: "error",
          title: "Could not save column widths",
          description: message,
          closable: true,
          action: {
            label: "Retry",
            onClick: () => {
              void persist(widthsRef.current);
            },
          },
        });
      }
    }
  };
  const measureWidth = (element: HTMLElement) =>
    element.closest("th")?.getBoundingClientRect().width ?? 0;
  const cancel = () => {
    if (!drag.current) return;
    widthsRef.current = drag.current.before;
    setDraft(drag.current.before);
    drag.current = undefined;
    setState({ status: "idle" });
  };

  return {
    widths,
    state,
    reset: () => void persist(changeAllToAuto()),
    retry: () => void persist(widthsRef.current),
    handleProps: (index: number) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.stopPropagation();
        // An earlier save must not clear a draft during this gesture.
        version.current++;
        setState({ status: "idle" });
        drag.current = {
          index,
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: measureWidth(event.currentTarget),
          before: [...widthsRef.current],
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        event.stopPropagation();
        changeWidth(
          index,
          clampColumnWidth(current.startWidth + event.clientX - current.startX),
        );
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        event.stopPropagation();
        drag.current = undefined;
        const next = changeWidth(
          index,
          clampColumnWidth(current.startWidth + event.clientX - current.startX),
        );
        event.currentTarget.releasePointerCapture(event.pointerId);
        void persist(next);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
      onClick: (event: React.MouseEvent<HTMLElement>) =>
        event.stopPropagation(),
      onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        void persist(changeWidth(index, 0));
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          cancel();
          return;
        }
        if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const current =
          widthsRef.current[index] || measureWidth(event.currentTarget);
        const delta =
          (event.shiftKey ? 50 : 10) * (event.key === "ArrowLeft" ? -1 : 1);
        void persist(
          changeWidth(
            index,
            event.key === "Home" ? 0 : clampColumnWidth(current + delta),
          ),
        );
      },
    }),
  };

  function changeAllToAuto() {
    widthsRef.current = [];
    setDraft([]);
    return [];
  }
};
