import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ComponentType } from "react";
import { readPreviewBasePath } from "./api/basePath";

const EmptyRoute = () => null;

export const createPreviewRouter = (
  rootComponent: ComponentType,
  initialEntries?: string[],
  basePath = readPreviewBasePath(),
) => {
  const rootRoute = createRootRoute({ component: rootComponent });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: EmptyRoute,
  });
  const documentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$documentId",
    component: EmptyRoute,
  });
  const documentCommentsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/documents/$documentId/comments",
    component: EmptyRoute,
  });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    documentRoute,
    documentCommentsRoute,
  ]);
  return createRouter({
    basepath: basePath || "/",
    defaultPendingMs: Number.POSITIVE_INFINITY,
    history: initialEntries
      ? createMemoryHistory({ initialEntries })
      : createBrowserHistory(),
    routeTree,
    // Document views restore only after their query-backed content is ready.
    // Leave list-page restoration to the router; do not race the document hook.
    scrollRestoration: ({ location }) =>
      !/\/documents\/[^/]+(?:\/comments)?$/.test(location.pathname),
  });
};

export type PreviewRouter = ReturnType<typeof createPreviewRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: PreviewRouter;
  }
}
