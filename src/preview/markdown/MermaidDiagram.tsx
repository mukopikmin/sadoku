import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  IconButton,
  Portal,
  VisuallyHidden,
} from "@chakra-ui/react";
import { Minus, Plus } from "lucide-react";
import { type RefObject, useContext } from "react";
import { useMermaidDiagram, useMermaidZoom } from "./useMermaidZoom";
import { Tooltip } from "../components/ui/tooltip";
import { MarkdownThemeContext } from "./MarkdownThemeContext";

const MermaidZoomContent = ({
  sourceRef,
}: {
  sourceRef: RefObject<HTMLPreElement | null>;
}) => {
  const { viewportRef, fit, zoomIn, zoomOut } = useMermaidZoom(sourceRef);
  return (
    <>
      <Dialog.Header>
        <Dialog.Title asChild>
          <VisuallyHidden>Zoomed Mermaid diagram</VisuallyHidden>
        </Dialog.Title>
        <HStack gap="2" flexWrap="wrap" pe="8">
          <Tooltip content="Zoom out">
            <IconButton
              aria-label="Zoom out Mermaid diagram"
              onClick={zoomOut}
              size="sm"
              variant="outline"
            >
              <Minus />
            </IconButton>
          </Tooltip>
          <Tooltip content="Zoom in">
            <IconButton
              aria-label="Zoom in Mermaid diagram"
              onClick={zoomIn}
              size="sm"
              variant="outline"
            >
              <Plus />
            </IconButton>
          </Tooltip>
          <Button
            aria-label="Fit Mermaid diagram to view"
            onClick={fit}
            size="sm"
            variant="outline"
          >
            Fit to view
          </Button>
        </HStack>
      </Dialog.Header>
      <Dialog.CloseTrigger asChild>
        <CloseButton aria-label="Close Mermaid diagram zoom" size="sm" />
      </Dialog.CloseTrigger>
      <Dialog.Body display="flex" minH="0">
        <Box
          className="mermaid-zoom-scroller"
          flex="1"
          minH="0"
          minW="0"
          overflow="auto"
          overflowAnchor="none"
          ref={viewportRef}
          scrollbarGutter="stable"
        />
      </Dialog.Body>
    </>
  );
};

export const MermaidDiagram = ({ source }: { source: string }) => {
  const theme = useContext(MarkdownThemeContext);
  const { sourceRef, state, setOpen } = useMermaidDiagram();

  return (
    <Dialog.Root
      lazyMount
      onOpenChange={({ open }) => {
        setOpen(open);
      }}
      open={state.status === "open"}
      size="cover"
      unmountOnExit
    >
      <Box className="mermaid-container" py="2">
        <Box position="relative">
          <pre className="mermaid" key={theme} ref={sourceRef}>
            {source}
          </pre>
          <Tooltip content="Zoom Mermaid diagram">
            <Dialog.Trigger asChild>
              <Button
                aria-label="Zoom Mermaid diagram"
                bg="canvas"
                color="fg"
                onClick={(event) => event.stopPropagation()}
                position="absolute"
                right="2"
                size="xs"
                top="2"
                type="button"
                variant="outline"
              >
                Zoom
              </Button>
            </Dialog.Trigger>
          </Tooltip>
        </Box>
      </Box>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner onClick={(event) => event.stopPropagation()}>
          <Dialog.Content>
            <MermaidZoomContent sourceRef={sourceRef} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
