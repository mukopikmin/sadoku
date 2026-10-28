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
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { Tooltip } from "../components/ui/tooltip";
import { initializeMermaidPinchZoom } from "./mermaidPinchZoom";

const useMermaidZoom = (sourceRef: RefObject<HTMLPreElement | null>) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReturnType<typeof initializeMermaidPinchZoom>>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const svg = sourceRef.current?.querySelector("svg");
    if (!viewport || !svg) return;
    viewport.replaceChildren(svg.cloneNode(true));
    const zoom = initializeMermaidPinchZoom(viewport);
    zoomRef.current = zoom;
    return () => {
      zoom.destroy();
      zoomRef.current = null;
      viewport.replaceChildren();
    };
  }, [sourceRef]);

  return {
    viewportRef,
    fit: () => zoomRef.current?.fit(),
    zoomIn: () => zoomRef.current?.zoomIn(),
    zoomOut: () => zoomRef.current?.zoomOut(),
  };
};

const MermaidZoomContent = (
  { sourceRef }: { sourceRef: RefObject<HTMLPreElement | null> },
) => {
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
  const sourceRef = useRef<HTMLPreElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root
      lazyMount
      onOpenChange={({ open }) => {
        setOpen(open && Boolean(sourceRef.current?.querySelector("svg")));
      }}
      open={open}
      size="cover"
      unmountOnExit
    >
      <Box className="mermaid-container" py="2">
        <Box position="relative">
          <pre className="mermaid" ref={sourceRef}>{source}</pre>
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
