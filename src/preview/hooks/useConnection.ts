import { useSyncExternalStore } from "react";
import { connectionSnapshot, subscribeConnection } from "../api/connection";

export const useConnection = () =>
  useSyncExternalStore(subscribeConnection, connectionSnapshot);
