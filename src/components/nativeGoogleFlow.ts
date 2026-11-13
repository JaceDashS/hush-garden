/** Native Google orchestration, separated from SDK loading so cancellation and nonce boundaries are testable. */
export interface NativeGoogleClient<User> {
  googleConfig(): Promise<{ enabled: boolean; clientId: string | null }>;
  nativeGoogleChallenge(): Promise<string>;
  nativeGoogleLogin(credential: string, nonce: string, remember: boolean): Promise<User>;
}
export interface NativeGoogleProvider {
  checkPlayServices(): Promise<unknown>;
  configure(options: { webClientId: string; nonce: string; autoSelectOnSignIn: boolean }): void;
  pickAccount(): Promise<string | null>;
}
/** Get a fresh server nonce for each explicit picker attempt and exchange only a live, successful selection. */
export async function signInWithNativeGoogle<User>(
  client: NativeGoogleClient<User>, provider: NativeGoogleProvider, remember: boolean,
  active: () => boolean = () => true,
): Promise<User | null> {
  const config = await client.googleConfig();
  if (!active()) return null;
  if (!config.enabled || !config.clientId) throw new Error("GOOGLE_NOT_CONFIGURED");
  await provider.checkPlayServices();
  if (!active()) return null;
  const nonce = await client.nativeGoogleChallenge();
  if (!active()) return null;
  provider.configure({ webClientId: config.clientId, nonce, autoSelectOnSignIn: false });
  const credential = await provider.pickAccount();
  if (!credential || !active()) return null;
  return client.nativeGoogleLogin(credential, nonce, remember);
}
