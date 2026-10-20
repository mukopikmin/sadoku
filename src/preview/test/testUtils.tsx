import { ChakraProvider, CodeBlock } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TransportProvider } from "@connectrpc/connect-query";
import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement, type ReactNode, useState } from "react";
import { createPreviewQueryClient } from "../queryClient";
import { sadokuChakraSystem } from "../theme";
import { Toaster } from "../components/ui/toaster";
import { shikiAdapter } from "../markdown/shikiAdapter";
import { previewTransport } from "../api/connect";

const TestProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(createPreviewQueryClient);
  return (
    <ChakraProvider value={sadokuChakraSystem}>
      <CodeBlock.AdapterProvider value={shikiAdapter}>
        <TransportProvider transport={previewTransport}>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster />
          </QueryClientProvider>
        </TransportProvider>
      </CodeBlock.AdapterProvider>
    </ChakraProvider>
  );
};

const renderWithChakra = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: TestProvider, ...options });

export {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from "./domTestUtils";
export {
  createComment,
  createCommentActions,
  createCommentReply,
} from "./commentFixtures";
export { renderWithChakra as render };
