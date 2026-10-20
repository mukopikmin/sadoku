import { RouterProvider } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { RenderOptions } from "@testing-library/react";
import { createPreviewRouter } from "../router";
import { render } from "./testUtils";

export const renderWithRouter = (
  ui: ReactElement,
  options?: RenderOptions,
) => {
  const router = createPreviewRouter(() => ui);
  return render(<RouterProvider router={router} />, options);
};
