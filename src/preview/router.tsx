import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ComponentType } from "react";

const EmptyRoute = () => null;

export const createPreviewRouter = (
  rootComponent: ComponentType,
  initialEntries?: string[],
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
    defaultPendingMs: Number.POSITIVE_INFINITY,
    history: initialEntries
      ? createMemoryHistory({ initialEntries })
      : createBrowserHistory(),
    routeTree,
    scrollRestoration: true,
  });
};

export type PreviewRouter = ReturnType<typeof createPreviewRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: PreviewRouter;
  }
}
