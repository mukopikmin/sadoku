type DirectoryPickerCommand = {
  args: string[];
  command: string;
};

export const buildDirectoryPickerCommand = (
  os: typeof Deno.build.os = Deno.build.os,
): DirectoryPickerCommand | undefined => {
  switch (os) {
    case "darwin":
      return {
        command: "osascript",
        args: [
          "-e",
          'POSIX path of (choose folder with prompt "Select the default folder")',
        ],
      };
    case "windows":
      return {
        command: "powershell.exe",
        args: [
          "-NoProfile",
          "-STA",
          "-Command",
          [
            "Add-Type -AssemblyName System.Windows.Forms",
            "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
            "$dialog.Description = 'Select the default folder'",
            "if ($dialog.ShowDialog() -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $dialog.SelectedPath }",
          ].join("; "),
        ],
      };
    case "linux":
      return {
        command: "zenity",
        args: [
          "--file-selection",
          "--directory",
          "--title=Select the default folder",
        ],
      };
    default:
      return undefined;
  }
};

export const selectDirectory = async (): Promise<string | undefined> => {
  const picker = buildDirectoryPickerCommand();
  if (!picker) {
    throw new Error(
      `Directory selection is not supported on ${Deno.build.os}.`,
    );
  }

  let result: Deno.CommandOutput;
  try {
    result = await new Deno.Command(picker.command, {
      args: picker.args,
      stderr: "null",
      stdout: "piped",
    }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Directory selection requires ${picker.command} to be installed.`,
      );
    }
    throw error;
  }

  if (!result.success) return undefined;
  const directory = new TextDecoder().decode(result.stdout).trim();
  return directory || undefined;
};
