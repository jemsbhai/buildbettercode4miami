/** Consume only known UI outcomes; never retain OAuth parameters in account-page history. */
export function consumeAccountReturnLocation(
  location: Pick<Location, "pathname" | "search" | "hash">,
  history: Pick<History, "state" | "replaceState">,
): "setup" | "signin" | undefined {
  const reason = new URLSearchParams(location.search).get("error");
  if (location.search || location.hash) history.replaceState(history.state, "", location.pathname);
  return reason === "setup" || reason === "signin" ? reason : undefined;
}
