/**
 * The catch all.
 *
 * Every capture() call elsewhere in this codebase is deliberate: somebody
 * decided that a particular failure was worth recording and wrote a line to
 * record it. This file is for the failures nobody anticipated, which are the
 * ones that matter most, because an unhandled exception in a route handler is
 * both the loudest kind of bug and the easiest kind to never hear about on a
 * serverless platform where the instance carrying the log line is gone a second
 * later.
 *
 * The framework calls onRequestError for anything thrown out of a server
 * component, route handler or server action. Wiring it here means a new route
 * is covered by error tracking on the day it is written rather than on the day
 * somebody remembers to add a try block to it.
 *
 * Note the dynamic import. This module is loaded in every runtime including the
 * edge one, where the Postgres driver cannot run at all, so observe.ts must not
 * be imported at the top level. The runtime check below is what keeps an edge
 * request from dragging a database client into a place it cannot exist.
 */

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error(`[${request.method} ${request.path}]`, err);
    return;
  }

  const { capture } = await import("./lib/observe");
  await capture("unhandled", err, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
}

export async function register() {
  // Nothing to set up. The export has to exist for the framework to load this
  // module at all, and onRequestError above is the only reason it is here.
}
