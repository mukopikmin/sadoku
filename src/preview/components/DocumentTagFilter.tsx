import {
  Button,
  createListCollection,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo } from "react";
import type { DocumentTag } from "../models/document";
import { filterTagsBySearch } from "../models/documentTree";
import { TagPicker, type TagPickerOption } from "./ui/TagPicker";

type DocumentTagFilterProps = {
  documentCount: number;
  filteredDocumentCount: number;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onSelectedTagIdsChange: (ids: number[]) => void;
  searchValue: string;
  selectedTagIds: number[];
  tags: DocumentTag[];
};

export const DocumentTagFilter = ({
  documentCount,
  filteredDocumentCount,
  onClearFilters,
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
      createListCollection<TagPickerOption>({
        items: matchingTags.map((tag) => ({
          value: String(tag.id),
          label: tag.name,
          tag,
        })),
        itemToString: (item) => item.label,
        itemToValue: (item) => item.value,
      }),
    [matchingTags],
  );

  return (
    <VStack align="stretch" gap="2">
      <TagPicker
        collection={collection}
        emptyMessage="No matching tags."
        inputLabel="Search tags"
        inputValue={searchValue}
        label="Filter by tag"
        maxWidth="320px"
        onInputValueChange={onSearchChange}
        onRemove={(tag) =>
          onSelectedTagIdsChange(
            selectedTagIds.filter((id) => id !== tag.id),
          )}
        onSelect={({ tag }) => {
          if (!tag) return;
          onSelectedTagIdsChange(
            selectedTagIds.includes(tag.id)
              ? selectedTagIds.filter((id) => id !== tag.id)
              : [...selectedTagIds, tag.id],
          );
          onSearchChange("");
        }}
        placeholder="Search tags to add"
        removeLabel={(tag) => `Remove ${tag.name} filter`}
        selectedTags={selectedTags}
      />
      {selectedTagIds.length > 0 && (
        <HStack gap="2" wrap="wrap">
          <Text color="fg.muted" fontSize="sm">
            Showing {filteredDocumentCount} of {documentCount} documents
          </Text>
          <Button onClick={onClearFilters} size="sm" variant="outline">
            Clear filters
          </Button>
        </HStack>
      )}
    </VStack>
  );
};
