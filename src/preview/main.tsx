import { ChakraProvider, CodeBlock } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { App } from "./App";
import { sadokuChakraSystem } from "./theme";
import { createPreviewQueryClient } from "./queryClient";
import { Toaster } from "./components/ui/toaster";
import { createPreviewRouter } from "./router";
import { shikiAdapter } from "./markdown/shikiAdapter";

const root = document.getElementById("sadoku-client-root");
const queryClient = createPreviewQueryClient();
const router = createPreviewRouter(App);

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ChakraProvider value={sadokuChakraSystem}>
        <CodeBlock.AdapterProvider value={shikiAdapter}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Toaster />
          </QueryClientProvider>
        </CodeBlock.AdapterProvider>
      </ChakraProvider>
    </StrictMode>,
  );
}
