/** In-room modal showing invite code, host country, live member roster, and host management controls. */
import * as Clipboard from "expo-clipboard";
import React from "react";
import { ScrollView, View } from "react-native";
import type { RoomDetail, RoomMember } from "../api/types";
import { useT } from "../i18n";
import { showMessage } from "../toasts";
import { Btn, Card, Check, T, colors } from "../ui";
import { countryFlag } from "./RoomLobby";

export function RoomPanel({
  room,
  myPeerId,
  members,
  onUpdateSettings,
  onTransferHost,
  onKick,
  onLeave,
  onClose,
}: {
  room: RoomDetail;
  myPeerId: string;
  members: readonly RoomMember[];
  onUpdateSettings: (patch: { maxPlayers?: number; allowInteraction?: boolean; allowGuestEdit?: boolean }) => void;
  onTransferHost: (peerId: string) => void;
  onKick: (peerId: string) => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const isHost = room.hostPeerId === myPeerId;
  const sortedMembers = [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.peerId.localeCompare(b.peerId));

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(room.code);
      showMessage(t("room.copiedCode"));
    } catch {
      showMessage(t("custom.copyFailed"));
    }
  };

  return (
    <Card title={room.name || t("room.title")} style={{ maxHeight: "100%" }}>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: colors.panelEdge, padding: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <T size={13.5} weight="800">{t("room.code", { code: room.code })}</T>
            <Btn small variant="mint" title={t("room.copyCode")} onPress={() => void copyCode()} testID="room-copy-code" />
          </View>
          <T size={12.5} tone="muted">
            {t("room.hostCountry", { country: `${countryFlag(room.hostCountry.code)} ${room.hostCountry.name} (${room.hostCountry.code})` })}
          </T>
        </View>

        {isHost && (
          <View style={{ backgroundColor: colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: colors.panelEdge, padding: 10, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T size={13} weight="700">{t("lobby.maxPlayers", { n: room.maxPlayers })}</T>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Btn small title="-" disabled={room.maxPlayers <= 2} onPress={() => onUpdateSettings({ maxPlayers: room.maxPlayers - 1 })} testID="room-max-dec" />
                <Btn small title="+" disabled={room.maxPlayers >= 16} onPress={() => onUpdateSettings({ maxPlayers: room.maxPlayers + 1 })} testID="room-max-inc" />
              </View>
            </View>
            <Check
              label={t("lobby.allowInteraction")}
              value={room.allowInteraction}
              onChange={(allowInteraction) => onUpdateSettings({ allowInteraction })}
              testID="room-toggle-interaction"
            />
            <Check
              label={t("lobby.allowGuestEdit")}
              value={room.allowGuestEdit}
              onChange={(allowGuestEdit) => onUpdateSettings({ allowGuestEdit })}
              testID="room-toggle-guest-edit"
            />
          </View>
        )}

        <View style={{ gap: 6 }}>
          <T size={12.5} tone="muted" weight="700">{t("room.members", { n: sortedMembers.length })}</T>
          {sortedMembers.map((member) => {
            const memberIsHost = member.peerId === room.hostPeerId;
            const isSelf = member.peerId === myPeerId;
            const tags = [
              memberIsHost ? t("room.hostBadge") : null,
              member.isGuest ? t("room.guestBadge") : null,
              member.muted ? t("room.mutedBadge") : null,
            ].filter(Boolean);
            return (
              <View
                key={member.peerId}
                testID={"room-member-" + member.peerId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: colors.white,
                  borderWidth: 1.5,
                  borderColor: memberIsHost ? colors.mintDeep : colors.panelEdge,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={13.5} weight="700" lines={1}>
                    {member.name + (tags.length ? ` (${tags.join(" · ")})` : "")}
                  </T>
                  <T size={11.5} tone="muted" lines={1}>
                    {`${countryFlag(member.country.code)} ${member.country.code} · ${member.place}`}
                  </T>
                </View>
                {isHost && !isSelf && (
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <Btn small variant="mint" title={t("room.transferHost")} onPress={() => onTransferHost(member.peerId)} testID={"room-transfer-" + member.peerId} />
                    <Btn small variant="danger" title={t("room.kick")} onPress={() => onKick(member.peerId)} testID={"room-kick-" + member.peerId} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn variant="danger" title={t("room.leave")} onPress={onLeave} testID="room-leave" />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title={t("common.close")} onPress={onClose} testID="room-close" />
        </View>
      </View>
    </Card>
  );
}
