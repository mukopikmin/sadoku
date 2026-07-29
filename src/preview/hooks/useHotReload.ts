import { useEffect, useState } from "react";
import { connectHotReload } from "../api/hotReload";

export const useHotReload = () => {
  const [reloadAvailable, setReloadAvailable] = useState(false);

  useEffect(() => {
    return connectHotReload({
      onReloadAvailable: () => setReloadAvailable(true),
    });
  }, []);

  return {
    clearReloadAvailable: () => setReloadAvailable(false),
    reloadAvailable,
  };
};
