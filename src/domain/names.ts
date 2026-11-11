/**
 * Character names. A player may change the name at any time. Names that could pass for staff or for the service
 * itself are refused. The server applies the same rule and is the one that decides.
 */

export const NAME_MAX_LENGTH = 16;

export type NameProblem = "empty" | "too_long" | "reserved";
export type NameCheck = { ok: true; name: string } | { ok: false; problem: NameProblem };

/** Refused anywhere inside a name, after simplifying it. */
const RESERVED_PARTS = [
  "admin", "administrator", "moderator", "staff", "official", "system", "support", "owner", "operator", "gamemaster", "developer", "jaces", "hushgarden",
  "관리자", "운영자", "운영진", "매니저", "공식", "시스템", "개발자", "어드민", "管理者", "運営",
];
/** Refused only when they are the whole name, because they are parts of ordinary words. */
const RESERVED_WHOLE = ["gm", "mod", "dev", "root", "sysop", "bot", "server", "host", "서버", "관리", "운영", "봇"];

const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "|": "i" };

/** Lower case, look-alike characters replaced, and everything except letters and digits removed. */
export function simplifyName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[013457@$!|]/g, (ch) => LOOKALIKES[ch] ?? "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function isReservedName(name: string): boolean {
  const simple = simplifyName(name);
  return RESERVED_WHOLE.includes(simple) || RESERVED_PARTS.some((part) => simple.includes(part));
}

/** Trims a typed name and checks it. Control characters are dropped and runs of spaces become one. */
export function checkName(value: unknown): NameCheck {
  // eslint-disable-next-line no-control-regex
  const name = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!name) return { ok: false, problem: "empty" };
  if ([...name].length > NAME_MAX_LENGTH) return { ok: false, problem: "too_long" };
  if (isReservedName(name)) return { ok: false, problem: "reserved" };
  return { ok: true, name };
}

export const NAME_PROBLEM_TEXT: Record<NameProblem, string> = {
  empty: "이름을 입력해 주세요.",
  too_long: "이름은 " + NAME_MAX_LENGTH + "자까지 쓸 수 있습니다.",
  reserved: "관리자나 운영자로 보일 수 있는 이름은 쓸 수 없습니다.",
};
