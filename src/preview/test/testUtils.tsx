import { ChakraProvider } from "@chakra-ui/react";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { sadokuChakraSystem } from "../theme";

const ChakraTestProvider = ({ children }: { children: ReactNode }) => (
  <ChakraProvider value={sadokuChakraSystem}>{children}</ChakraProvider>
);

const renderWithChakra = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: ChakraTestProvider, ...options });

export * from "@testing-library/react";
export { renderWithChakra as render };
