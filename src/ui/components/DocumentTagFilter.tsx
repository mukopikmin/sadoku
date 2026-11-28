import { createListCollection } from "@chakra-ui/react";
import { useMemo } from "react";
import type { DocumentTag } from "../models/document";
import { TagPicker, type TagPickerOption } from "./ui/TagPicker";

type DocumentTagFilterProps = {
  onSearchChange: (value: string) => void;
  onSelectTag: (id: number) => void;
  onRemoveTag: (id: number) => void;
  searchValue: string;
  selectedTags: DocumentTag[];
  matchingTags: DocumentTag[];
};

export const DocumentTagFilter = ({
  onSearchChange,
  onSelectTag,
  onRemoveTag,
  searchValue,
  selectedTags,
  matchingTags,
}: DocumentTagFilterProps) => {
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
    <TagPicker
      collection={collection}
      emptyMessage="No matching tags."
      inputLabel="Search tags"
      inputValue={searchValue}
      label="Filter by tag"
      maxWidth="xs"
      onInputValueChange={onSearchChange}
      onRemove={(tag) => onRemoveTag(tag.id)}
      onSelect={({ tag }) => {
        if (tag) onSelectTag(tag.id);
      }}
      placeholder="Search tags to add"
      removeLabel={(tag) => `Remove ${tag.name} filter`}
      selectedTags={selectedTags}
    />
  );
};
