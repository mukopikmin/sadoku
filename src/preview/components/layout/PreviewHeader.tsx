import {
  Box,
  Container,
  Flex,
  Float,
  IconButton,
  Image,
  Link,
  Tabs,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

export type PreviewView = "comments" | "preview";

export const PreviewShell = ({ children }: { children: ReactNode }) => (
  <Flex
    as="header"
    position="sticky"
    top="0"
    zIndex="10"
    w="full"
    mb="8"
    borderBottomWidth="1px"
    borderColor="border.muted"
    bg="canvas"
    color="fg.muted"
    fontSize="sm"
  >
    <Container
      display="flex"
      maxW="980px"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap="4"
      px="8"
      py="4"
    >
      {children}
    </Container>
  </Flex>
);

type PreviewHeaderProps = {
  fileUrl: string;
  onChangeView: (view: PreviewView) => void;
  onReloadPreview: () => void;
  onOpenSettings: () => void;
  reloadAvailable: boolean;
  reloading: boolean;
  staleCommentCount: number;
  title: string;
  unresolvedCommentCount: number;
  view: PreviewView;
};

export const PreviewHeader = ({
  fileUrl,
  onChangeView,
  onReloadPreview,
  onOpenSettings,
  reloadAvailable,
  reloading,
  staleCommentCount,
  title,
  unresolvedCommentCount,
  view,
}: PreviewHeaderProps) => (
  <PreviewShell>
    <Flex alignItems="center" flex="1 1 16rem" gap="3" minW="0">
      <Image
        alt="Sadoku"
        flexShrink="0"
        h="10"
        src="/assets/icon-512.png"
        w="10"
      />
      <Text as="div" minW="0">
        Previewing{" "}
        <Link href={fileUrl} color="fg" fontWeight="semibold">
          {title}
        </Link>.
      </Text>
    </Flex>
    <Flex
      as="nav"
      aria-label="Preview views"
      alignItems="center"
      flex="0 1 auto"
      minW="0"
      wrap="wrap"
      gap="2"
    >
      <IconButton
        aria-label="Open settings"
        onClick={onOpenSettings}
        size="sm"
        type="button"
        variant="outline"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="1em"
          viewBox="0 0 16 16"
          width="1em"
        >
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.7 1.8h2.6l.4 1.5c.3.1.6.3.9.5l1.5-.5 1.3 2.2-1.1 1.1v1l1.1 1.1-1.3 2.2-1.5-.5-.9.5-.4 1.5H6.7l-.4-1.5-.9-.5-1.5.5-1.3-2.2 1.1-1.1v-1L2.6 5.5l1.3-2.2 1.5.5.9-.5.4-1.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
        </svg>
      </IconButton>
      {reloadAvailable && (
        <IconButton
          aria-label={reloading ? "Reloading preview" : "Reload preview"}
          colorPalette="yellow"
          disabled={reloading}
          onClick={onReloadPreview}
          size="sm"
          type="button"
          variant="outline"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="1em"
            viewBox="0 0 16 16"
            width="1em"
          >
            <path
              d="M13.5 5.5V2.5m0 0h-3m3 0-2.1 2.1a5 5 0 1 0 1.3 5.1"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      )}
      <Tabs.Root
        onValueChange={({ value }) => onChangeView(value as PreviewView)}
        size="sm"
        value={view}
        variant="enclosed"
      >
        <Tabs.List>
          <Tabs.Trigger
            onClick={() => onChangeView("preview")}
            value="preview"
          >
            Preview
          </Tabs.Trigger>
          <Tabs.Trigger
            aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
            onClick={() => onChangeView("comments")}
            position="relative"
            value="comments"
          >
            Comments
            {staleCommentCount > 0 && (
              <Box as="span" ml="1" color="warning.fg">
                Stale {staleCommentCount}
              </Box>
            )}
            {unresolvedCommentCount > 0 && (
              <Float
                aria-hidden="true"
                as="span"
                bg="blue.solid"
                borderRadius="full"
                color="blue.contrast"
                fontSize="2xs"
                fontWeight="bold"
                minW="5"
                offset="1"
                px="1"
              >
                {unresolvedCommentCount}
              </Float>
            )}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content display="none" value={view} />
      </Tabs.Root>
    </Flex>
  </PreviewShell>
);
