import { useState } from "react";
import {
  isValidExcludedDirectory,
  isValidMarkdownExtension,
} from "../components/settings/settingsValidation";
import type { DirectoryDiscoverySettingsProps } from "../components/settings/DirectoryDiscoverySettings";

type FieldState = { status: "valid" } | { status: "invalid"; message: string };
export const useDirectoryDiscovery = (
  props: DirectoryDiscoverySettingsProps,
) => {
  const [directories, setDirectories] = useState<FieldState>({
    status: "valid",
  });
  const [extensions, setExtensions] = useState<FieldState>({ status: "valid" });
  return {
    directories,
    extensions,
    changeDepth: (input: string) => {
      const value = Number(input);
      if (Number.isInteger(value) && value >= 0)
        props.onDirectoryLimitsChange(value, props.maxFiles);
    },
    changeFiles: (input: string) => {
      const value = Number(input);
      if (Number.isInteger(value) && value >= 1)
        props.onDirectoryLimitsChange(props.maxDepth, value);
    },
    clearDirectoryError: () => setDirectories({ status: "valid" }),
    invalidDirectory: () =>
      setDirectories({
        status: "invalid",
        message: "Enter a directory name without path separators.",
      }),
    validateDirectory: (value: string) =>
      isValidExcludedDirectory(value.trim()),
    changeDirectories: (value: string[]) => {
      setDirectories({ status: "valid" });
      props.onExcludedDirectoriesChange(value);
    },
    clearExtensionError: () => setExtensions({ status: "valid" }),
    invalidExtension: () =>
      setExtensions({
        status: "invalid",
        message: "Enter an extension beginning with a dot.",
      }),
    validateExtension: (value: string) =>
      isValidMarkdownExtension(value.trim()),
    changeExtensions: (value: string[]) => {
      if (!value.length) {
        setExtensions({
          status: "invalid",
          message: "Add at least one extension.",
        });
        return;
      }
      setExtensions({ status: "valid" });
      props.onMarkdownExtensionsChange(value);
    },
  };
};
