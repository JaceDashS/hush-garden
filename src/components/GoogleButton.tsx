import type { HushClient } from "../api/client";
import type { User } from "../api/types";

export interface GoogleButtonProps {
  client: HushClient;
  remember: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onLoggedIn: (user: User) => Promise<void>;
}

/** Google sign-in is offered in the browser only. The native apps sign in with the account name and password. */
export function GoogleButton(_props: GoogleButtonProps) {
  return null;
}
