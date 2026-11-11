import {
  Box,
  CloseButton,
  Dialog,
  IconButton,
  Portal,
  Text,
  TreeView,
} from "@chakra-ui/react";
import { ChevronRight, List as ListIcon } from "lucide-react";
import { memo } from "react";
import { useTableOfContents } from "../../hooks/useTableOfContents";
import type { TableOfContentsNode } from "../../models/tableOfContents";
import { Tooltip } from "../../components/ui/tooltip";

const ContentsNode = ({
  node,
  indexPath,
}: {
  node: TableOfContentsNode;
  indexPath: number[];
}) => (
  <TreeView.NodeProvider node={node} indexPath={indexPath}>
    {node.children.length > 0 ? (
      <TreeView.Branch aria-label={node.text}>
        <TreeView.BranchControl aria-label={node.text}>
          <TreeView.BranchTrigger aria-label={`Toggle ${node.text}`}>
            <TreeView.BranchIndicator>
              <ChevronRight aria-hidden="true" />
            </TreeView.BranchIndicator>
          </TreeView.BranchTrigger>
          <TreeView.BranchText>{node.text}</TreeView.BranchText>
        </TreeView.BranchControl>
        <TreeView.BranchContent>
          <TreeView.BranchIndentGuide />
          {node.children.map((child, index) => (
            <ContentsNode
              key={child.id}
              node={child}
              indexPath={[...indexPath, index]}
            />
          ))}
        </TreeView.BranchContent>
      </TreeView.Branch>
    ) : (
      <TreeView.Item>
        <TreeView.ItemText>{node.text}</TreeView.ItemText>
      </TreeView.Item>
    )}
  </TreeView.NodeProvider>
);

export const TableOfContents = memo(function TableOfContents({
  markdown,
}: {
  markdown: string;
}) {
  const contents = useTableOfContents(markdown);

  return (
    <Dialog.Root
      onOpenChange={({ open }) => contents.setOpen(open)}
      open={contents.open}
      placement="center"
      scrollBehavior="inside"
    >
      <Tooltip content="Table of contents">
        <span style={{ display: "inline-flex" }}>
          <Dialog.Trigger asChild>
            <IconButton
              aria-label="Table of contents"
              size="sm"
              type="button"
              variant="outline"
            >
              <ListIcon aria-hidden="true" />
            </IconButton>
          </Dialog.Trigger>
        </span>
      </Tooltip>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Table of contents</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">
              {contents.state.status === "empty" ? (
                <Text>No headings</Text>
              ) : (
                <Box as="nav" aria-label="Table of contents">
                  <TreeView.Root
                    key={markdown}
                    collection={contents.state.collection}
                    defaultExpandedValue={contents.state.expandedValue}
                    expandOnClick={false}
                    selectedValue={[]}
                    onSelectionChange={({ selectedNodes }) =>
                      contents.select(selectedNodes)
                    }
                  >
                    <TreeView.Tree aria-label="Table of contents">
                      {contents.state.collection.rootNode.children.map(
                        (node, index) => (
                          <ContentsNode
                            key={node.id}
                            node={node}
                            indexPath={[index]}
                          />
                        ),
                      )}
                    </TreeView.Tree>
                  </TreeView.Root>
                </Box>
              )}
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close table of contents" size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
});
