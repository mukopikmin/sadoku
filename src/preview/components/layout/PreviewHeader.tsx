import { previewPath } from "../../api/basePath";

import {
  Badge,
  Container,
  Flex,
  IconButton,
  Image,
  Link,
  Text,
} from "@chakra-ui/react";
import { Database, RefreshCw, Settings, Tag } from "lucide-react";
import type { ReactNode, RefObject } from "react";

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
  connectionLost: boolean;
  fileUrl?: string;
  onReloadPreview: () => void;
  onOpenTags: () => void;
  onOpenSettings: () => void;
  onOpenStatistics: () => void;
  reloadAvailable: boolean;
  reloading: boolean;
  tagsTriggerRef?: RefObject<HTMLButtonElement | null>;
  title: string;
};

export const PreviewHeader = ({
  connectionLost,
  fileUrl,
  onReloadPreview,
  onOpenSettings,
  onOpenStatistics,
  onOpenTags,
  reloadAvailable,
  reloading,
  tagsTriggerRef,
  title,
}: PreviewHeaderProps) => (
  <PreviewShell>
    <Flex alignItems="center" flex="1 1 16rem" gap="3" minW="0">
      <Image
        alt="Sadoku"
        flexShrink="0"
        h="8"
        src={previewPath("/assets/icon-512.png")}
        w="8"
      />
      {fileUrl
        ? (
          <Text as="div" minW="0">
            Previewing{" "}
            <Link href={fileUrl} color="fg" fontWeight="semibold">
              {title}
            </Link>.
          </Text>
        )
        : <Text fontWeight="semibold">{title}</Text>}
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
      {connectionLost && (
        <Badge
          colorPalette="red"
          role="status"
          variant="solid"
        >
          Connection lost
        </Badge>
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
      <IconButton
        aria-label="Open database statistics"
        onClick={onOpenStatistics}
        size="sm"
        type="button"
        variant="outline"
      >
        <Database aria-hidden="true" />
      </IconButton>
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
