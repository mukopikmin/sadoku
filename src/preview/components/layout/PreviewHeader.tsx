import { previewPath } from "../../api/basePath";

import {
  Container,
  Flex,
  Icon,
  IconButton,
  Image,
  Link,
  Separator,
  Text,
} from "@chakra-ui/react";
import {
  RefreshCw,
  ScrollText,
  Settings,
  Tag,
  WifiOff,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Tooltip } from "../ui/tooltip";
import { TableOfContents } from "../../pages/markdown/TableOfContents";

export const PreviewShell = ({ children, headerRef }: {
  children: ReactNode;
  headerRef?: RefObject<HTMLDivElement | null>;
}) => (
  <Flex
    as="header"
    ref={headerRef}
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
  collapsedDocument?: { title?: string; markdown: string };
  connectionLost: boolean;
  fileUrl?: string;
  globalInstructionsTriggerRef?: RefObject<HTMLButtonElement | null>;
  onOpenGlobalInstructions: () => void;
  headerRef?: RefObject<HTMLDivElement | null>;
  onReloadPreview: () => void;
  onOpenTags: () => void;
  onOpenSettings: () => void;
  reloadAvailable: boolean;
  reloading: boolean;
  tagsTriggerRef?: RefObject<HTMLButtonElement | null>;
  title: string;
};

export const PreviewHeader = ({
  collapsedDocument,
  connectionLost,
  fileUrl,
  globalInstructionsTriggerRef,
  onOpenGlobalInstructions,
  headerRef,
  onReloadPreview,
  onOpenSettings,
  onOpenTags,
  reloadAvailable,
  reloading,
  tagsTriggerRef,
  title,
}: PreviewHeaderProps) => (
  <PreviewShell headerRef={headerRef}>
    <Flex alignItems="center" flex="1 1 16rem" gap="3" minW="0">
      <Image
        alt="Sadoku"
        flexShrink="0"
        h="8"
        src={previewPath("/assets/icon-512.png")}
        w="8"
      />
      <Flex direction="column" gap="1" minW="0" flex="1">
        {fileUrl
          ? (
            <Text as="div" minW="0" truncate title={title}>
              Previewing{" "}
              <Link href={fileUrl} color="fg" fontWeight="semibold">
                {title}
              </Link>.
            </Text>
          )
          : (
            <Text minW="0" truncate fontWeight="semibold" title={title}>
              {title}
            </Text>
          )}
        {collapsedDocument?.title && (
          <Text
            minW="0"
            truncate
            color="fg"
            fontWeight="semibold"
            title={collapsedDocument.title}
          >
            {collapsedDocument.title}
          </Text>
        )}
      </Flex>
    </Flex>
    <Flex
      as="nav"
      aria-label="Application actions"
      alignItems="center"
      flex="0 1 auto"
      minW="0"
      wrap="wrap"
      gap="2"
    >
      {collapsedDocument && (
        <Flex alignItems="center" gap="3" flexShrink="0">
          <TableOfContents markdown={collapsedDocument.markdown} />
          <Separator orientation="vertical" h="6" borderColor="border.muted" />
        </Flex>
      )}
      {connectionLost && (
        <Tooltip content="Connection lost">
          <Flex
            as="span"
            alignItems="center"
            color="fg.error"
            role="status"
            tabIndex={0}
          >
            <Icon asChild size="5">
              <WifiOff aria-hidden="true" />
            </Icon>
            <Text srOnly>Connection lost</Text>
          </Flex>
        </Tooltip>
      )}
      <IconButton
        aria-label="Open tags"
        onClick={onOpenTags}
        size="sm"
        type="button"
        variant="outline"
        ref={tagsTriggerRef}
      >
        <Tag aria-hidden="true" />
      </IconButton>
      <Tooltip content="Global instructions">
        <IconButton
          aria-label="Open global instructions"
          onClick={onOpenGlobalInstructions}
          ref={globalInstructionsTriggerRef}
          size="sm"
          type="button"
          variant="outline"
        >
          <ScrollText aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <IconButton
        aria-label="Open settings"
        onClick={onOpenSettings}
        size="sm"
        type="button"
        variant="outline"
      >
        <Settings aria-hidden="true" />
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
          <RefreshCw aria-hidden="true" />
        </IconButton>
      )}
    </Flex>
  </PreviewShell>
);
