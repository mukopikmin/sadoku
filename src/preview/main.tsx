import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { sadokuChakraSystem } from "./theme";
import { createPreviewQueryClient } from "./queryClient";

const root = document.getElementById("sadoku-client-root");
const queryClient = createPreviewQueryClient();

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ChakraProvider value={sadokuChakraSystem}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ChakraProvider>
    </StrictMode>,
  );
}
