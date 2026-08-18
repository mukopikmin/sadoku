import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup as testingLibraryCleanup,
  render,
  renderHook,
  type RenderOptions,
} from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactElement, type ReactNode, useState } from "react";
import type { CommentActions } from "../api/commentActions";
import { createPreviewQueryClient } from "../queryClient";
import { sadokuChakraSystem } from "../theme";
import { Toaster } from "../components/ui/toaster";
import { createPreviewRouter } from "../router";

const TestProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(createPreviewQueryClient);
  return (
    <ChakraProvider value={sadokuChakraSystem}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ChakraProvider>
  );
};

const renderWithChakra = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: TestProvider, ...options });

export const renderWithRouter = (
  ui: ReactElement,
  options?: RenderOptions,
) => {
  const router = createPreviewRouter(() => ui);
  return render(<RouterProvider router={router} />, {
    wrapper: TestProvider,
    ...options,
  });
};

export const cleanup = () => {
  testingLibraryCleanup();
  globalThis.history.replaceState(null, "", "/");
};

export const createCommentActions = (
  overrides: Partial<CommentActions> = {},
): CommentActions => ({
  onCreateComment: async () => {},
  onDeleteComment: async () => {},
  onDeleteReply: async () => {},
  onReopenComment: async () => {},
  onReplyComment: async () => {},
  onResolveComment: async () => {},
  onUpdateComment: async () => {},
  onUpdateReply: async () => {},
  ...overrides,
});

export {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
export { renderWithChakra as render };
