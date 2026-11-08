import { useEffect, useState } from "react";

export const useNestedDialog = (parentOpen: boolean) => {
  const [state, setState] = useState<{ status: "closed" | "open" }>({
    status: "closed",
  });
  useEffect(() => {
    if (!parentOpen) setState({ status: "closed" });
  }, [parentOpen]);
  return {
    state,
    setOpen: (open: boolean) =>
      setState({ status: parentOpen && open ? "open" : "closed" }),
  };
};
