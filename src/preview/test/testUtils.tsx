import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement, type ReactNode, useState } from "react";
import type { CommentActions } from "../api/commentActions";
import { createPreviewQueryClient } from "../queryClient";
import { sadokuChakraSystem } from "../theme";

const TestProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(createPreviewQueryClient);
  return (
    <ChakraProvider value={sadokuChakraSystem}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ChakraProvider>
  );
};

const renderWithChakra = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: TestProvider, ...options });

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

export * from "@testing-library/react";
export { renderWithChakra as render };
