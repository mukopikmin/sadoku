import { createContext } from "react";
import type { useTableLayouts } from "../hooks/useTableLayouts";

export const TableLayoutContext = createContext<
  ReturnType<typeof useTableLayouts> | undefined
>(undefined);
