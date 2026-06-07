export const serveHandlerInfo = {} as Deno.ServeHandlerInfo<Deno.NetAddr>;

export const createTempMarkdown = async (
  markdown = "# Title\n\nBody\n",
): Promise<string> => {
  const filePath = await Deno.makeTempFile({
    prefix: "mdview-",
    suffix: ".md",
  });
  await Deno.writeTextFile(filePath, markdown);
  return filePath;
};

export const removeTempMarkdown = async (filePath: string): Promise<void> => {
  await Deno.remove(filePath).catch(() => {});
  await Deno.remove(`${filePath}.mdview-comments.json`).catch(() => {});
};
