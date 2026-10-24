import { dirname, isAbsolute, join, relative, resolve } from "@std/path";
import type {
  DocumentRestorer,
  RestoreDocumentError,
} from "../../usecase/document/restore_document_revision.ts";

export const createLocalDocumentRestorer = (
  rootPath: string,
): DocumentRestorer => {
  const checkPath = async (filePath: string) => {
    const root = await Deno.realPath(rootPath);
    const destination = resolve(root, relative(resolve(rootPath), filePath));
    const path = relative(root, destination);
    if (
      isAbsolute(path) || path === ".." || path.startsWith("../") ||
      path.startsWith("..\\")
    ) {
      throw { type: "restore_unsafe_path" } satisfies RestoreDocumentError;
    }
    let parent = root;
    for (const part of path.split(/[\\/]/)) {
      parent = join(parent, part);
      try {
        const info = await Deno.lstat(parent);
        if (
          info.isSymlink ||
          (parent === destination ? !info.isFile : !info.isDirectory)
        ) {
          throw { type: "restore_unsafe_path" } satisfies RestoreDocumentError;
        }
      } catch (error) {
        if (parent === destination && error instanceof Deno.errors.NotFound) {
          continue;
        }
        throw error;
      }
    }
    return destination;
  };
  const read = async (filePath: string) => {
    const destination = await checkPath(filePath);
    try {
      return await Deno.readTextFile(destination);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    }
  };
  return {
    read,
    replace: async (filePath, markdown, expectedMarkdown) => {
      const destination = await checkPath(filePath);
      const temporary = await Deno.makeTempFile({
        dir: dirname(destination),
        prefix: ".sadoku-",
      });
      try {
        await Deno.writeTextFile(temporary, markdown);
        const info = await Deno.lstat(destination).catch((error) => {
          if (error instanceof Deno.errors.NotFound) return undefined;
          throw error;
        });
        if (info?.mode !== null && info?.mode !== undefined) {
          await Deno.chmod(temporary, info.mode);
        }
        if (await read(filePath) !== expectedMarkdown) {
          throw { type: "restore_conflict" } satisfies RestoreDocumentError;
        }
        await Deno.rename(temporary, destination);
      } finally {
        await Deno.remove(temporary).catch((error) => {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        });
      }
    },
  };
};
