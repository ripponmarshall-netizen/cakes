/*
 * Stand-ins for the Supabase file Storage and Edge Functions clients, which
 * this app never uses. vite.config.ts points @supabase/storage-js and
 * @supabase/functions-js here, so the ~27 kB they add to every page load stays
 * out of the bundle. supabase-js builds a StorageClient when it starts (that
 * must not throw); anything that actually tries to use either says why it
 * can't. If a later supabase-js imports another name from them, the build
 * fails loudly rather than the app breaking quietly: add it here.
 */

const unavailable = (what: string) => new Error(`${what} isn’t included in this app (see src/lib/supabaseStubs.ts).`)

export class StorageClient {
  constructor(..._args: unknown[]) {}
  from(): never {
    throw unavailable('Supabase Storage')
  }
}

export class StorageApiError extends Error {}

export class FunctionsClient {
  constructor(..._args: unknown[]) {}
  setAuth() {}
  invoke(): never {
    throw unavailable('Supabase Edge Functions')
  }
}

export class FunctionsError extends Error {}
export class FunctionsFetchError extends FunctionsError {}
export class FunctionsHttpError extends FunctionsError {}
export class FunctionsRelayError extends FunctionsError {}
export const FunctionRegion = {} as Record<string, string>
