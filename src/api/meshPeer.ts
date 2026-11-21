/** WebRTC full-mesh peer connection manager for 1-hop player movement, chat, actions, and toy-hammer bonks. */
import { cleanMessage } from "../domain/chat";
import type { SourceLook } from "../domain/sound";
import { clampToGarden, type Point } from "../domain/world";

const MOVE_INTERVAL_MS = 60;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export type MeshDataMessage =
  | { t: "helloPos"; x: number; y: number }
  | { t: "move"; x: number; y: number }
  | { t: "chat"; text: string; color?: string; x: number; y: number }
  | { t: "bonk"; targetId: string; x: number; y: number }
  | { t: "action"; name: "create" | "discard"; look: SourceLook; facing?: 1 | -1 };

export function isWebRtcSupported(): boolean {
  return typeof RTCPeerConnection !== "undefined";
}

function readCoords(v: Record<string, unknown>): Point | null {
  if (typeof v.x !== "number" || typeof v.y !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  return clampToGarden({ x: v.x, y: v.y });
}

export function parseMeshMessage(raw: string): MeshDataMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  switch (m.t) {
    case "helloPos":
    case "move": {
      const point = readCoords(m);
      return point ? { t: m.t, x: point.x, y: point.y } : null;
    }
    case "chat": {
      const text = cleanMessage(m.text);
      const point = readCoords(m);
      if (!text || !point) return null;
      const color = typeof m.color === "string" && /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color.toLowerCase() : undefined;
      return { t: "chat", text, ...(color ? { color } : {}), x: point.x, y: point.y };
    }
    case "bonk": {
      const point = readCoords(m);
      if (typeof m.targetId !== "string" || !m.targetId || !point) return null;
      return { t: "bonk", targetId: m.targetId, x: point.x, y: point.y };
    }
    case "action": {
      if ((m.name !== "create" && m.name !== "discard") || typeof m.look !== "string" || !m.look) return null;
      return {
        t: "action",
        name: m.name,
        look: m.look as SourceLook,
        ...(m.facing === 1 || m.facing === -1 ? { facing: m.facing } : {}),
      };
    }
    default:
      return null;
  }
}

interface PeerSlot {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

export class MeshPeerManager {
  private peers = new Map<string, PeerSlot>();
  private lastMoveAt = 0;
  private pendingMove: Point | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly myPeerId: string,
    private readonly sendSignal: (to: string, payload: { description?: unknown; candidate?: unknown }) => void,
    private readonly onMessage: (fromPeerId: string, message: MeshDataMessage) => void,
    private readonly getMyPosition: () => Point,
    private readonly onConnectionFailed?: (peerId: string) => void,
  ) {}

  connectPeer(remotePeerId: string): void {
    if (this.closed || !isWebRtcSupported() || remotePeerId === this.myPeerId || this.peers.has(remotePeerId)) return;
    this.ensurePeer(remotePeerId, this.myPeerId < remotePeerId);
  }

  private ensurePeer(remotePeerId: string, shouldOffer: boolean): PeerSlot {
    const existing = this.peers.get(remotePeerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const polite = this.myPeerId > remotePeerId;
    const slot: PeerSlot = {
      pc,
      dc: null,
      makingOffer: false,
      ignoreOffer: false,
      polite,
      pendingCandidates: [],
    };
    this.peers.set(remotePeerId, slot);

    pc.onicecandidate = (event) => {
      if (event.candidate && !this.closed) {
        this.sendSignal(remotePeerId, { candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        this.onConnectionFailed?.(remotePeerId);
      }
    };

    pc.ondatachannel = (event) => {
      this.attachChannel(remotePeerId, slot, event.channel);
    };

    pc.onnegotiationneeded = async () => {
      try {
        slot.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription && !this.closed) {
          this.sendSignal(remotePeerId, { description: pc.localDescription });
        }
      } catch {
        // Ignore transient negotiation errors during teardown.
      } finally {
        slot.makingOffer = false;
      }
    };

    if (shouldOffer) {
      const dc = pc.createDataChannel("hush", { ordered: true });
      this.attachChannel(remotePeerId, slot, dc);
    }

    return slot;
  }

  private attachChannel(remotePeerId: string, slot: PeerSlot, dc: RTCDataChannel): void {
    slot.dc = dc;
    dc.onopen = () => {
      const pos = this.getMyPosition();
      this.sendOnChannel(dc, { t: "helloPos", x: pos.x, y: pos.y });
    };
    dc.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const msg = parseMeshMessage(event.data);
      if (msg) this.onMessage(remotePeerId, msg);
    };
  }

  async handleSignal(fromPeerId: string, payload: { description?: unknown; candidate?: unknown }): Promise<void> {
    if (this.closed || !isWebRtcSupported()) return;
    const slot = this.ensurePeer(fromPeerId, false);
    const { pc } = slot;

    try {
      if (payload.description && typeof payload.description === "object") {
        const desc = payload.description as RTCSessionDescriptionInit;
        const offerCollision = desc.type === "offer" && (slot.makingOffer || pc.signalingState !== "stable");
        slot.ignoreOffer = !slot.polite && offerCollision;
        if (slot.ignoreOffer) return;

        await pc.setRemoteDescription(desc);
        while (slot.pendingCandidates.length > 0) {
          const candidate = slot.pendingCandidates.shift()!;
          await pc.addIceCandidate(candidate).catch(() => undefined);
        }
        if (desc.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription && !this.closed) {
            this.sendSignal(fromPeerId, { description: pc.localDescription });
          }
        }
      } else if (payload.candidate && typeof payload.candidate === "object") {
        const candidate = payload.candidate as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate).catch(() => undefined);
        } else {
          slot.pendingCandidates.push(candidate);
        }
      }
    } catch {
      // Ignore malformed or out-of-order signaling frames.
    }
  }

  removePeer(remotePeerId: string): void {
    const slot = this.peers.get(remotePeerId);
    if (!slot) return;
    this.peers.delete(remotePeerId);
    try { slot.dc?.close(); } catch { /* ignore */ }
    try { slot.pc.close(); } catch { /* ignore */ }
  }

  /** Throttled broadcast of the player's position over direct peer DataChannels. */
  move(point: Point): void {
    this.pendingMove = point;
    if (this.moveTimer) return;
    const wait = Math.max(0, MOVE_INTERVAL_MS - (Date.now() - this.lastMoveAt));
    this.moveTimer = setTimeout(() => {
      this.moveTimer = null;
      this.lastMoveAt = Date.now();
      if (this.pendingMove) {
        this.broadcast({ t: "move", x: this.pendingMove.x, y: this.pendingMove.y });
      }
      this.pendingMove = null;
    }, wait);
  }

  broadcast(message: MeshDataMessage): void {
    const encoded = JSON.stringify(message);
    for (const slot of this.peers.values()) {
      if (slot.dc?.readyState === "open") {
        try { slot.dc.send(encoded); } catch { /* ignore */ }
      }
    }
  }

  sendTo(peerId: string, message: MeshDataMessage): void {
    const slot = this.peers.get(peerId);
    if (slot?.dc) this.sendOnChannel(slot.dc, message);
  }

  private sendOnChannel(dc: RTCDataChannel, message: MeshDataMessage): void {
    if (dc.readyState !== "open") return;
    try { dc.send(JSON.stringify(message)); } catch { /* ignore */ }
  }

  closeAll(): void {
    this.closed = true;
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.moveTimer = null;
    this.pendingMove = null;
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
  }
}
