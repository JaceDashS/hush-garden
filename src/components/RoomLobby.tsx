/** P2P Room Lobby: location consent, room browser (with host country), invite-code join, and room creation. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HushClient } from "../api/client";
import { isWebRtcSupported } from "../api/meshPeer";
import { ApiError, type PublicRoomSummary, type RoomEntryResponse, type User } from "../api/types";
import { getDeviceId } from "../deviceId";
import { randomRoomNamePlaceholder, type TextKey } from "../domain/text";
import { useT } from "../i18n";
import { requestCoordinates } from "../location";
import type { Settings } from "../settings";
import { showMessage } from "../toasts";
import { Btn, Card, Check, Chips, Input, Modal, T, colors } from "../ui";
import { ConsentCard, LoginCard } from "./Panels";

export function countryFlag(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === "LOCAL") return "🏠";
  if (!/^[A-Z]{2}$/.test(upper) || upper === "XX") return "🌐";
  const a = 0x1f1e6 + upper.charCodeAt(0) - 65;
  const b = 0x1f1e6 + upper.charCodeAt(1) - 65;
  return String.fromCodePoint(a, b);
}

const ROOM_ERRORS: Record<string, TextKey> = {
  ROOM_NOT_FOUND: "lobby.roomNotFound",
  ROOM_FULL: "lobby.roomFull",
  BANNED: "lobby.banned",
  RATE_LIMITED: "notice.rateLimited",
  LOGIN_REQUIRED: "lobby.createLoginNeeded",
};

export function RoomLobby({
  client,
  settings,
  onSettings,
  onEnterRoom,
  onSyncAccount,
  onBack,
}: {
  client: HushClient;
  settings: Settings;
  onSettings: (next: Settings) => void;
  onEnterRoom: (res: RoomEntryResponse) => void;
  onSyncAccount: () => Promise<void>;
  onBack: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<PublicRoomSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TextKey | "">("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState<User | null>(() => client.currentUser);
  const [inviteCode, setInviteCode] = useState("");

  const [roomName, setRoomName] = useState("");
  const placeholderSeed = useRef(Math.random()).current;
  const roomPlaceholder = useMemo(
    () => randomRoomNamePlaceholder(settings.language, () => placeholderSeed),
    [settings.language, placeholderSeed],
  );
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [allowInteraction, setAllowInteraction] = useState(true);
  const [allowGuestEdit, setAllowGuestEdit] = useState(false);

  const webrtcOk = isWebRtcSupported();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await client.listRooms();
      setRooms(list);
    } catch {
      setError("notice.connectFailed");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    setUser(client.currentUser);
    if (settings.consent) void refresh();
  }, [client, settings.consent, refresh]);

  const handleLogin = async (nextUser: User) => {
    setUser(nextUser);
    setLoginOpen(false);
    await onSyncAccount();
  };

  const handleLogout = async () => {
    try {
      await client.logout();
      setUser(null);
    } catch {
      showMessage(t("notice.logoutFailed"));
    }
  };

  const join = async (target: { roomId?: string; code?: string }) => {
    if (busy || !webrtcOk) return;
    setBusy(true);
    setError("");
    try {
      const [coordinates, deviceId] = await Promise.all([requestCoordinates(), getDeviceId()]);
      const res = await client.joinRoom({
        coordinates,
        ...target,
        character: settings.character,
        customCharacter: settings.customCharacter || undefined,
        deviceId,
      });
      onEnterRoom(res);
    } catch (cause) {
      const code = cause instanceof ApiError ? ROOM_ERRORS[cause.code] : undefined;
      setError(code || "notice.connectFailed");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (busy || !user || !webrtcOk) return;
    setBusy(true);
    setError("");
    try {
      const [coordinates, deviceId] = await Promise.all([requestCoordinates(), getDeviceId()]);
      const res = await client.createRoom({
        coordinates,
        name: roomName.trim() || roomPlaceholder,
        visibility,
        maxPlayers,
        allowInteraction,
        allowGuestEdit,
        character: settings.character,
        customCharacter: settings.customCharacter || undefined,
        deviceId,
      });
      onEnterRoom(res);
    } catch (cause) {
      const code = cause instanceof ApiError ? ROOM_ERRORS[cause.code] : undefined;
      setError(code || "notice.requestFailed");
    } finally {
      setBusy(false);
    }
  };

  if (!settings.consent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 420 }}>
          <ConsentCard
            busy={false}
            error=""
            onCancel={onBack}
            onAgree={() => onSettings({ ...settings, consent: true })}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, alignItems: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 680, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Btn small title={t("common.back")} onPress={onBack} testID="lobby-back" />
            <T size={20} weight="800" style={{ flex: 1, textAlign: "center" }} lines={1}>{t("lobby.title")}</T>
            {user ? (
              <Btn small title={t("settings.logout")} onPress={() => void handleLogout()} testID="lobby-logout" />
            ) : (
              <Btn small variant="mint" title={t("login.submit")} onPress={() => setLoginOpen(true)} testID="lobby-login" />
            )}
          </View>

          {!webrtcOk && (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.danger, padding: 12 }}>
              <T size={13} tone="danger" weight="700">{t("lobby.webrtcUnsupported")}</T>
            </View>
          )}

          {!!error && (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.danger, padding: 12 }}>
              <T size={13} tone="danger" weight="700">{t(error)}</T>
            </View>
          )}

          <Card>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t("lobby.joinCodePlaceholder")}
                  placeholder={t("lobby.joinCodePlaceholder")}
                  value={inviteCode}
                  maxLength={12}
                  onChangeText={(text) => setInviteCode(text.toUpperCase())}
                  onSubmit={() => inviteCode.trim() && void join({ code: inviteCode.trim() })}
                  testID="lobby-code-input"
                />
              </View>
              <Btn
                small
                variant="mint"
                title={t("lobby.joinByCode")}
                disabled={busy || !inviteCode.trim() || !webrtcOk}
                onPress={() => void join({ code: inviteCode.trim() })}
                testID="lobby-code-join"
              />
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T size={16} weight="800">{t("lobby.title")}</T>
              <Btn small title={t("lobby.refresh")} disabled={loading} onPress={() => void refresh()} testID="lobby-refresh" />
            </View>
            {rooms === null || loading ? (
              <T size={13} tone="muted">{t("custom.loading")}</T>
            ) : rooms.length === 0 ? (
              <T size={13} tone="muted">{t("lobby.empty")}</T>
            ) : (
              <View style={{ gap: 8 }}>
                {rooms.map((room) => (
                  <View
                    key={room.id}
                    testID={"room-item-" + room.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 14,
                      backgroundColor: colors.white,
                      borderWidth: 2,
                      borderColor: colors.panelEdge,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <T size={15} weight="800" lines={1}>{room.name}</T>
                      <T size={12.5} tone="muted" lines={1}>
                        {`${countryFlag(room.hostCountry.code)} ${room.hostCountry.code} · ${room.hostName} · ${t("lobby.players", { count: room.playerCount, max: room.maxPlayers })}`}
                      </T>
                      <T size={11.5} tone="muted" lines={1}>
                        {`${t(room.allowInteraction ? "lobby.interactionOn" : "lobby.interactionOff")} · ${t(room.allowGuestEdit ? "lobby.guestEditOn" : "lobby.guestEditOff")}`}
                      </T>
                    </View>
                    <Btn
                      small
                      variant="primary"
                      title={t("lobby.join")}
                      disabled={busy || !webrtcOk || room.playerCount >= room.maxPlayers}
                      onPress={() => void join({ roomId: room.id })}
                      testID={"room-join-" + room.id}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card title={t("lobby.createTitle")}>
            {!user ? (
              <View style={{ gap: 8 }}>
                <T size={13} tone="muted">{t("lobby.createLoginNeeded")}</T>
                <Btn small variant="mint" title={t("login.submit")} onPress={() => setLoginOpen(true)} testID="lobby-create-login" />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Input
                  label={t("lobby.roomName")}
                  placeholder={roomPlaceholder}
                  value={roomName}
                  maxLength={32}
                  onChangeText={setRoomName}
                  testID="create-room-name"
                />
                <View style={{ gap: 4 }}>
                  <T size={12.5} tone="muted" weight="700">{t("lobby.visibility")}</T>
                  <Chips
                    label={t("lobby.visibility")}
                    value={visibility}
                    options={[
                      { value: "public", label: t("lobby.public") },
                      { value: "private", label: t("lobby.private") },
                    ]}
                    onChange={setVisibility}
                    testID="create-room-visibility"
                  />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <T size={13.5} weight="700">{t("lobby.maxPlayers", { n: maxPlayers })}</T>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Btn small title="-" disabled={maxPlayers <= 2} onPress={() => setMaxPlayers((n) => Math.max(2, n - 1))} testID="create-room-max-dec" />
                    <Btn small title="+" disabled={maxPlayers >= 16} onPress={() => setMaxPlayers((n) => Math.min(16, n + 1))} testID="create-room-max-inc" />
                  </View>
                </View>
                <Check
                  label={t("lobby.allowInteraction")}
                  value={allowInteraction}
                  onChange={setAllowInteraction}
                  testID="create-room-interaction"
                />
                <Check
                  label={t("lobby.allowGuestEdit")}
                  value={allowGuestEdit}
                  onChange={setAllowGuestEdit}
                  testID="create-room-guest-edit"
                />
                <Btn
                  variant="primary"
                  title={busy ? t("lobby.creating") : t("lobby.create")}
                  disabled={busy || !webrtcOk}
                  onPress={() => void create()}
                  testID="create-room-submit"
                />
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      {loginOpen && (
        <Modal onClose={() => setLoginOpen(false)}>
          <LoginCard client={client} onLoggedIn={handleLogin} onClose={() => setLoginOpen(false)} />
        </Modal>
      )}
    </View>
  );
}
