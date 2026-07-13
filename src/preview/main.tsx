import { ChakraProvider } from "@chakra-ui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { sadokuChakraSystem } from "./theme";

const root = document.getElementById("sadoku-client-root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ChakraProvider value={sadokuChakraSystem}>
        <App />
      </ChakraProvider>
    </StrictMode>,
  );
}
