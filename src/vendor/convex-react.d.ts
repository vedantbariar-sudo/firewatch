/**
 * Local type declarations for the `convex/react` package entry.
 *
 * This file exists so the project keeps typechecking even when the `convex`
 * package's published type declarations (`dist/cjs-types/react/*.d.ts`)
 * cannot be resolved in a given build environment. It mirrors the small API
 * surface this app actually imports from `convex/react` — nothing more.
 *
 * `tsconfig.app.json` maps the `convex/react` specifier here, so these
 * signatures are what TypeScript sees in every environment. At runtime the
 * bundler still resolves the real `convex/react` package, so this file has no
 * effect on the app. If the underlying resolution issue is ever fixed and the
 * real types are preferred, delete this file and remove the `convex/react`
 * entry from `paths` in `tsconfig.app.json`.
 */

/** Matches the `FunctionReference` type exported by `convex/server`. */
export interface ConvexFunctionReference {
  _type: string;
  _args: unknown;
  _returnType: unknown;
}

export class ConvexReactClient {
  constructor(url: string);
}

/** Reactive query hook — returns the query's return type (or undefined while loading). */
export function useQuery<
  Query extends ConvexFunctionReference,
>(
  query: Query,
  ...args: Query["_args"] extends undefined ? never[] : Query["_args"][]
): Query["_returnType"] | undefined;

/** Current Convex auth state. */
export function useConvexAuth(): {
  isLoading: boolean;
  isAuthenticated: boolean;
};
