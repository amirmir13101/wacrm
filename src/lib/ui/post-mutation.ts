type RefreshableRouter = {
  replace: (href: string) => void;
  refresh: () => void;
};

export function refreshClientRoute(router: RefreshableRouter, path?: string) {
  if (path) router.replace(path);
  router.refresh();
}
