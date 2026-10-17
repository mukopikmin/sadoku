import { isAbsolute, join, relative, resolve } from "@std/path";
import type {
  CreateDocumentError,
  DocumentCreator,
} from "../../usecase/document/create_document.ts";

export const createLocalDocumentCreator = (
  rootPath: string,
): DocumentCreator => ({
  create: async (directory, filename, markdown) => {
    const root = await Deno.realPath(rootPath);
    const destination = resolve(root, directory);
    const relativeDirectory = relative(root, destination);
    if (
      isAbsolute(relativeDirectory) || relativeDirectory === ".." ||
      relativeDirectory.startsWith("../") ||
      relativeDirectory.startsWith("..\\")
    ) {
      throw {
        type: "invalid_document_input",
        message: "Choose a directory inside the open folder.",
      } satisfies CreateDocumentError;
    }
    let parent = root;
    for (const part of directory.split("/").filter(Boolean)) {
      parent = join(parent, part);
      let stat: Deno.FileInfo;
      try {
        stat = await Deno.lstat(parent);
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
        throw {
          type: "invalid_document_input",
          message: "The destination directory no longer exists.",
        } satisfies CreateDocumentError;
      }
      if (!stat.isDirectory || stat.isSymlink) {
        throw {
          type: "invalid_document_input",
          message: "Choose an existing directory without symbolic links.",
        } satisfies CreateDocumentError;
      }
    }
    const filePath = join(destination, filename);
    const temporaryPath = await Deno.makeTempFile({
      dir: destination,
      prefix: ".sadoku-",
    });
    let reserved = false;
    let published = false;
    try {
      await Deno.writeTextFile(temporaryPath, markdown);
      // Reserve the new name exclusively before replacing our own reservation
      // with the completed file. Existing files, folders and symlinks are kept.
      const reservation = await Deno.open(filePath, {
        write: true,
        createNew: true,
      });
      reserved = true;
      reservation.close();
      await Deno.rename(temporaryPath, filePath);
      published = true;
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) {
        throw {
          type: "document_exists",
          message: "A file or folder with this name already exists.",
        } satisfies CreateDocumentError;
      }
      throw error;
    } finally {
      if (!published) {
        await Deno.remove(temporaryPath);
        if (reserved) await Deno.remove(filePath);
      }
    }
    return resolve(rootPath, directory, filename);
  },
});
