import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { TDAsset, TDBinding, TDShape } from "@tldraw/tldraw";

const VERSION = 1;

export const doc = new Y.Doc();
export const roomID = `y-tldraw-${VERSION}`;

export const provider = new WebsocketProvider(
  "wss://draw-yjss-server-production.up.railway.app",
  roomID,
  doc,
  {
    connect: true,
    maxBackoffTime: 10000,
  },
);

export const awareness = provider.awareness;

export const yShapes: Y.Map<TDShape> = doc.getMap("shapes");
export const yBindings: Y.Map<TDBinding> = doc.getMap("bindings");
export const yAssets: Y.Map<TDAsset> = doc.getMap("assets");

console.log("yAssets map создан, clientID:", awareness.clientID);

// Undo только для shapes и bindings (assets не нужно отменять обычно)
export const undoManager = new Y.UndoManager([yShapes, yBindings]);

// НЕ очищаем yAssets при загрузке страницы!
// if (typeof window !== 'undefined') { yAssets.clear(); }

// Фикс протокола + лёгкий лог
yAssets.observeDeep((events) => {
  if (events.length === 0) return;

  console.log(`yAssets: ${yAssets.size} ассетов (${events.length} изменений)`);

  // Исправляем http → https если вдруг попало
  let needsUpdate = false;
  const updates: Record<string, TDAsset> = {};

  yAssets.forEach((asset, id) => {
    if ((asset.type === "image" || asset.type === "video") && asset.src?.startsWith("http://")) {
      updates[id] = { ...asset, src: asset.src.replace(/^http:\/\//, "https://") };
      needsUpdate = true;
    }
  });

  if (needsUpdate) {
    doc.transact(() => {
      Object.entries(updates).forEach(([id, fixed]) => {
        yAssets.set(id, fixed);
      });
    });
  }
});