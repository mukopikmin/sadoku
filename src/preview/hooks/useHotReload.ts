import { useEffect, useState } from "react";
import { connectHotReload } from "../hot_reload";

export const useHotReload = () => {
  const [reloadAvailable, setReloadAvailable] = useState(false);

  useEffect(() => {
    return connectHotReload({
      onReloadAvailable: () => setReloadAvailable(true),
    });
  }, []);

  return { reloadAvailable };
};
