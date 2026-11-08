import { useAsyncAction } from "./useAsyncAction";
import { toaster } from "../components/ui/toaster";

type Options = {
  title: string;
  description: string;
  onError?: (error: unknown) => void;
};
export const useClipboard = (text: string, options: Options) => {
  const action = useAsyncAction();
  return {
    state: action.state,
    copy: () =>
      action.run(async () => {
        await navigator.clipboard.writeText(text);
        toaster.create({
          closable: true,
          title: options.title,
          description: options.description,
          type: "success",
        });
      }, options.onError),
  };
};
