/**
 * Settings group for custom characters: copy the AI prompt, see the account's uploaded characters with their
 * review state, use or delete one, and upload a new image map when the account may.
 */
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { ApiError } from "../api/types";
import type { HushClient } from "../api/client";
import { characterPrompt } from "../domain/characterPrompt";
import { API_ORIGIN } from "../config";
import { CHARACTER_NAME_MAX, SHEET, readPngSize, sheetUrl, type CharacterList, type OwnCharacter } from "../domain/imageCharacters";
import type { TextKey } from "../domain/text";
import { useSheet } from "../game/imageCharacter";
import { useLanguage, useT } from "../i18n";
import type { Settings } from "../settings";
import { showMessage } from "../toasts";
import { Btn, Input, T, colors } from "../ui";
import { pickPng } from "./pickPng";

/** Size of the still picture in the list. */
const STILL = 44;

const UPLOAD_ERRORS: Record<string, TextKey> = {
  CHARACTER_LIMIT: "custom.full",
  INVALID_CHARACTER_IMAGE: "custom.wrongSize",
  INVALID_CHARACTER_NAME: "custom.nameNeeded",
  FORBIDDEN: "custom.noPermission",
};

/** The standing frame of an approved character, or an empty box while it loads or before approval. */
function Still({ character }: { character: OwnCharacter }) {
  const approved = character.status === "approved";
  const { ready, loader } = useSheet(approved ? character.id : undefined);
  const scale = STILL / SHEET.frame;
  return (
    <View style={{ width: STILL, height: STILL, borderRadius: 10, backgroundColor: colors.white, overflow: "hidden" }}>
      {approved && ready && <Image source={{ uri: sheetUrl(API_ORIGIN, character.id) }} style={{ position: "absolute", left: 0, top: 0, width: SHEET.width * scale, height: SHEET.height * scale }} />}
      {loader}
    </View>
  );
}

function stateText(t: ReturnType<typeof useT>, character: OwnCharacter): string {
  if (character.status === "approved") return t("custom.approved", { name: character.reviewedBy?.username ?? "?" });
  if (character.status === "rejected") return character.rejectReason ? t("custom.rejectedReason", { reason: character.rejectReason }) : t("custom.rejected");
  return t("custom.pending");
}

export function MyCharacters({ client, loggedIn, open, settings, onChange }: { client: HushClient; loggedIn: boolean; open: boolean; settings: Settings; onChange: (settings: Settings) => void }) {
  const t = useT();
  const language = useLanguage();
  const [list, setList] = useState<CharacterList | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<TextKey | "">("");

  /** A character in use that is not approved any more is dropped from the settings. */
  const apply = useCallback(
    (next: CharacterList) => {
      setList(next);
      setFailed(false);
      const current = settings.customCharacter;
      if (current && !next.characters.some((item) => item.id === current && item.status === "approved")) onChange({ ...settings, customCharacter: "" });
    },
    [settings, onChange],
  );

  useEffect(() => {
    if (!open || !loggedIn) return;
    let alive = true;
    client.myCharacters().then((next) => alive && apply(next), () => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // Reloaded each time the settings open; `apply` changes with every settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loggedIn, client]);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(characterPrompt(language));
      showMessage(t("custom.copied"));
    } catch {
      showMessage(t("custom.copyFailed"));
    }
  };

  const upload = async () => {
    const trimmed = name.trim();
    if (!trimmed || [...trimmed].length > CHARACTER_NAME_MAX) return setProblem("custom.nameNeeded");
    setProblem("");
    let png: string | null;
    try {
      png = await pickPng();
    } catch {
      return setProblem("custom.failed");
    }
    if (!png) return;
    const size = readPngSize(png);
    if (!size || size.width !== SHEET.width || size.height !== SHEET.height) return setProblem("custom.wrongSize");
    setBusy(true);
    try {
      apply(await client.uploadCharacter(trimmed, png));
      setName("");
      showMessage(t("custom.uploaded"));
    } catch (cause) {
      setProblem((cause instanceof ApiError && UPLOAD_ERRORS[cause.code]) || "custom.failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (confirming !== id) return setConfirming(id);
    setConfirming(null);
    setBusy(true);
    try {
      apply(await client.deleteCharacter(id));
    } catch {
      setProblem("custom.failed");
    } finally {
      setBusy(false);
    }
  };

  const count = list ? list.characters.filter((item) => item.status !== "rejected").length : 0;
  return (
    <View style={{ gap: 8 }}>
      <T size={12} tone="muted">{t("custom.help")}</T>
      <Btn small variant="mint" title={t("custom.copy")} onPress={() => void copy()} testID="custom-copy-prompt" />
      {!loggedIn && <T size={12.5} tone="muted">{t("custom.loginNeeded")}</T>}
      {loggedIn && !list && <T size={12.5} tone="muted">{failed ? t("custom.failed") : t("custom.loading")}</T>}
      {loggedIn && list && (
        <>
          {list.characters.length === 0 && <T size={12.5} tone="muted">{t("custom.none")}</T>}
          {list.characters.map((character) => {
            const inUse = settings.customCharacter === character.id;
            return (
              <View key={character.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }} testID={"custom-" + character.id}>
                <Still character={character} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={14} weight="700" lines={1}>{character.name}</T>
                  <T size={11.5} tone={character.status === "rejected" ? "danger" : "muted"} lines={2}>{stateText(t, character)}</T>
                </View>
                {character.status === "approved" && (
                  <Btn small variant={inUse ? "plain" : "primary"} title={inUse ? t("custom.inUse") : t("custom.use")} disabled={inUse || busy} onPress={() => onChange({ ...settings, customCharacter: character.id })} testID={"custom-use-" + character.id} />
                )}
                <Btn small variant="danger" title={confirming === character.id ? t("custom.confirmDelete") : t("custom.delete")} disabled={busy} onPress={() => void remove(character.id)} testID={"custom-delete-" + character.id} />
              </View>
            );
          })}
          {list.canUpload && count < list.limit && (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input label={t("custom.name")} placeholder={t("custom.name")} value={name} maxLength={CHARACTER_NAME_MAX} onChangeText={setName} onSubmit={() => void upload()} testID="custom-name" />
              </View>
              <Btn small variant="mint" title={busy ? t("custom.uploading") : t("custom.upload")} disabled={busy} onPress={() => void upload()} testID="custom-upload" />
            </View>
          )}
          {list.canUpload && count >= list.limit && <T size={12.5} tone="muted">{t("custom.full", { limit: list.limit })}</T>}
          {!list.canUpload && <T size={12.5} tone="muted">{t("custom.noPermission")}</T>}
          {!!problem && <T size={12.5} tone="danger">{t(problem, { limit: list.limit })}</T>}
        </>
      )}
    </View>
  );
}
