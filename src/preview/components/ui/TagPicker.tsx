import {
  chakra,
  Combobox,
  type ListCollection,
  Portal,
  useSlotRecipe,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import type { DocumentTag } from "../../models/document";
import { getTagColorStyle, TagLabel } from "./TagLabel";

export type TagPickerOption =
  | { value: string; label: string; tag: DocumentTag }
  | { value: "create"; label: string; tag?: never };

type TagPickerProps = {
  collection: ListCollection<TagPickerOption>;
  disabled?: boolean;
  emptyMessage: string;
  inputLabel?: string;
  inputValue: string;
  label: string;
  maxWidth?: string;
  onInputSubmit?: () => void;
  onInputValueChange: (value: string) => void;
  onRemove: (tag: DocumentTag) => void;
  onSelect: (option: TagPickerOption) => void;
  placeholder: string;
  portalled?: boolean;
  removeLabel?: (tag: DocumentTag) => string;
  selectedTags: DocumentTag[];
};

export const TagPicker = ({
  collection,
  disabled,
  emptyMessage,
  inputLabel,
  inputValue,
  label,
  maxWidth,
  onInputSubmit,
  onInputValueChange,
  onRemove,
  onSelect,
  placeholder,
  portalled = true,
  removeLabel = (tag) => `Remove ${tag.name} tag`,
  selectedTags,
}: TagPickerProps) => {
  const tagsInputRecipe = useSlotRecipe({ key: "tagsInput" });
  const tagsInputStyles = tagsInputRecipe();

  return (
    <Combobox.Root
      closeOnSelect
      collection={collection}
      css={tagsInputStyles.root}
      disabled={disabled}
      inputValue={inputValue}
      maxW={maxWidth}
      multiple
      onInputValueChange={({ inputValue }) => onInputValueChange(inputValue)}
      onSelect={({ itemValue }) => {
        const option = collection.find(itemValue);
        if (option) onSelect(option);
      }}
      openOnClick
      positioning={{ sameWidth: true }}
      selectionBehavior="preserve"
      value={selectedTags.map(({ id }) => String(id))}
    >
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Control
        css={tagsInputStyles.control}
        pe="10"
        _focusWithin={{ focusRing: "inside" }}
      >
        {selectedTags.map((tag) => (
          <chakra.div
            css={tagsInputStyles.itemPreview}
            key={tag.id}
            style={getTagColorStyle(tag.backgroundColor)}
          >
            <chakra.span css={tagsInputStyles.itemText}>
              {tag.name}
            </chakra.span>
            <chakra.button
              aria-label={removeLabel(tag)}
              css={tagsInputStyles.itemDeleteTrigger}
              disabled={disabled}
              onClick={() => onRemove(tag)}
              type="button"
            >
              <X />
            </chakra.button>
          </chakra.div>
        ))}
        <Combobox.Input
          aria-label={inputLabel ?? label}
          css={tagsInputStyles.input}
          onKeyDown={(event) => {
            if (
              onInputSubmit && event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              !event.currentTarget.getAttribute("aria-activedescendant")
            ) {
              event.preventDefault();
              onInputSubmit();
            }
          }}
          placeholder={placeholder}
          unstyled
        />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger aria-label="Show tag options" />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal disabled={!portalled}>
        <Combobox.Positioner>
          <Combobox.Content maxH="64" overflowY="auto">
            <Combobox.ItemGroup>
              <Combobox.ItemGroupLabel>Tags</Combobox.ItemGroupLabel>
              {collection.items.map((item) => (
                <Combobox.Item item={item} key={item.value}>
                  {item.tag
                    ? (
                      <TagLabel
                        backgroundColor={item.tag.backgroundColor}
                        name={item.tag.name}
                      />
                    )
                    : item.label}
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              ))}
              <Combobox.Empty>{emptyMessage}</Combobox.Empty>
            </Combobox.ItemGroup>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
