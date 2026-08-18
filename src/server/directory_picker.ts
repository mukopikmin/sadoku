import { dirname, join, resolve } from "@std/path";

export type DirectoryListing = {
  directories: Array<{ name: string; path: string }>;
  parent?: string;
  path: string;
};

export const listDirectories = async (
  requestedPath?: string,
): Promise<DirectoryListing> => {
  const path = resolve(requestedPath || Deno.cwd());
  const stat = await Deno.stat(path);
  if (!stat.isDirectory) {
    throw new Error(`Not a directory: ${path}`);
  }

  const directories: DirectoryListing["directories"] = [];
  for await (const entry of Deno.readDir(path)) {
    if (entry.isDirectory && !entry.isSymlink) {
      directories.push({ name: entry.name, path: join(path, entry.name) });
    }
  }
  directories.sort((left, right) => left.name.localeCompare(right.name));

  const parent = dirname(path);
  return {
    directories,
    ...(parent === path ? {} : { parent }),
    path,
  };
};
