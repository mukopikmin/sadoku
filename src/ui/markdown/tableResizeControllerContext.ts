import { createContext } from "react";
import type { useTableColumnResize } from "./useTableColumnResize";

export const TableResizeControllerContext = createContext<
  (ReturnType<typeof useTableColumnResize> & { tableId: string }) | undefined
>(undefined);
