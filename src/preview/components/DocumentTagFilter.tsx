import {
  Combobox,
  createListCollection,
  Portal,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { useMemo } from "react";
import type { DocumentTag } from "../models/document";
import { filterTagsBySearch } from "../models/documentTree";
import { TagLabel } from "./ui/TagLabel";

type DocumentTagFilterProps = {
  documentCount: number;
  filteredDocumentCount: number;
  onSearchChange: (value: string) => void;
  onSelectedTagIdsChange: (ids: number[]) => void;
  searchValue: string;
  selectedTagIds: number[];
  tags: DocumentTag[];
};

export const DocumentTagFilter = ({
  documentCount,
  filteredDocumentCount,
  onSearchChange,
  onSelectedTagIdsChange,
  searchValue,
  selectedTagIds,
  tags,
}: DocumentTagFilterProps) => {
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
  const matchingTags = useMemo(
    () => filterTagsBySearch(tags, searchValue),
    [searchValue, tags],
  );
  const collection = useMemo(
    () =>
      createListCollection({
        items: matchingTags,
        itemToString: (tag) => tag.name,
        itemToValue: (tag) => String(tag.id),
      }),
    [matchingTags],
  );

  return (
    <VStack align="stretch" gap="2">
      <Combobox.Root
        closeOnSelect
        collection={collection}
        inputValue={searchValue}
        multiple
        onInputValueChange={({ inputValue }) => onSearchChange(inputValue)}
        onValueChange={({ value }) =>
          onSelectedTagIdsChange(
            value.map(Number).filter(Number.isSafeInteger),
          )}
        positioning={{ sameWidth: true }}
        value={selectedTagIds.map(String)}
        width="320px"
        maxW="full"
      >
        <Combobox.Label>Filter by tag</Combobox.Label>
        <Wrap gap="2">
          {selectedTags.map((tag) => (
            <TagLabel
              backgroundColor={tag.backgroundColor}
              key={tag.id}
              name={tag.name}
            />
          ))}
        </Wrap>
        <Combobox.Control>
          <Combobox.Input
            aria-label="Search tags"
            placeholder="Search tags to add"
          />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger aria-label="Show tag options" />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content maxH="48" overflowY="auto">
              <Combobox.ItemGroup>
                <Combobox.ItemGroupLabel>Tags</Combobox.ItemGroupLabel>
                {matchingTags.map((tag) => (
                  <Combobox.Item item={tag} key={tag.id}>
                    <TagLabel
                      backgroundColor={tag.backgroundColor}
                      name={tag.name}
                    />
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))}
                <Combobox.Empty>No matching tags.</Combobox.Empty>
              </Combobox.ItemGroup>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
      {selectedTagIds.length > 0 && (
        <Text color="fg.muted" fontSize="sm">
          Showing {filteredDocumentCount} of {documentCount} documents
        </Text>
      )}
    </VStack>
  );
};
