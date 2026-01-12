import {
  TDBinding,
  TDShape,
  TDUser,
  TldrawApp,
  ImageShape,
  VideoShape,
} from "@tldraw/tldraw";

import { useCallback, useEffect, useRef } from "react";
import {
  awareness,
  doc,
  provider,
  undoManager,
  yBindings,
  yShapes,
} from "../store";

// Type guard (теперь используем ImageShape и VideoShape)
function isImageOrVideoShape(shape: TDShape): shape is ImageShape | VideoShape {
  return shape.type === "image" || shape.type === "video";
}

// Функция загрузки на сервер
async function uploadToMyServer(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    "https://draw-yjss-assets-production.up.railway.app/upload",
    {
      method: "POST",
      body: formData,
    },
  );

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }

  const { url } = await res.json();
  return url;
}

export function useMultiplayerState(roomId: string) {
  const tldrawRef = useRef<TldrawApp>();

  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomId);
      app.pause();
      tldrawRef.current = app;

      app.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {},
      );
    },
    [roomId],
  );

  const onChangePage = useCallback(
    async (
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
    ) => {
      // 1. Стандартное сохранение в Yjs
      undoManager.stopCapturing();

      doc.transact(() => {
        Object.entries(shapes).forEach(([id, shape]) => {
          if (!shape) {
            yShapes.delete(id);
          } else {
            yShapes.set(shape.id, shape);
          }
        });

        Object.entries(bindings).forEach(([id, binding]) => {
          if (!binding) {
            yBindings.delete(id);
          } else {
            yBindings.set(binding.id, binding);
          }
        });
      });

      // 2. Обработка ассетов (только новые локальные src)
      const assetPromises = Object.values(shapes)
        .filter((shape): shape is TDShape => !!shape)
        .filter(isImageOrVideoShape)
        .filter((shape) => {
          const src = shape.props.src;
          return (
            src &&
            (src.startsWith("blob:") || src.startsWith("data:")) &&
            !src.startsWith("http://") &&
            !src.startsWith("https://")
          );
        })
        .map(async (shape) => {
          try {
            let file: Blob;

            if (shape.props.src!.startsWith("data:")) {
              const [, base64] = shape.props.src!.split(",");
              const byteString = atob(base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);

              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }

              const mime =
                shape.props.mimeType ||
                (shape.type === "image" ? "image/png" : "video/mp4");

              file = new Blob([ab], { type: mime });
            } else {
              // blob:
              const response = await fetch(shape.props.src!);
              if (!response.ok) {
                throw new Error(`Blob fetch failed: ${response.status}`);
              }
              file = await response.blob();
            }

            const newUrl = await uploadToMyServer(file);

            // Обновляем в Yjs
            doc.transact(() => {
              const updatedShape = {
                ...shape,
                props: { ...shape.props, src: newUrl },
              };
              yShapes.set(shape.id, updatedShape);
            });

            // Обновляем в текущем app
            app?.patchCreate([updatedShape]);
          } catch (err) {
            console.error(`Ошибка обработки ассета ${shape.id}:`, err);
          }
        });

      if (assetPromises.length > 0) {
        await Promise.all(assetPromises);
      }
    },
    [],
  );

  const onUndo = useCallback(() => {
    undoManager.undo();
  }, []);

  const onRedo = useCallback(() => {
    undoManager.redo();
  }, []);

  const onChangePresence = useCallback((app: TldrawApp, user: TDUser) => {
    awareness.setLocalStateField("tdUser", user);
  }, []);

  useEffect(() => {
    const onChangeAwareness = () => {
      const tldraw = tldrawRef.current;
      if (!tldraw || !tldraw.room) return;

      const others = Array.from(awareness.getStates().entries())
        .filter(([key]) => key !== awareness.clientID)
        .map(([, state]) => state)
        .filter((user) => user.tdUser !== undefined);

      const ids = others.map((other) => other.tdUser.id as string);

      Object.values(tldraw.room.users).forEach((user) => {
        if (user && !ids.includes(user.id) && user.id !== tldraw.room?.userId) {
          tldraw.removeUser(user.id);
        }
      });

      tldraw.updateUsers(others.map((other) => other.tdUser).filter(Boolean));
    };

    awareness.on("change", onChangeAwareness);
    return () => awareness.off("change", onChangeAwareness);
  }, []);

  useEffect(() => {
    function handleChanges() {
      const tldraw = tldrawRef.current;
      if (!tldraw) return;

      tldraw.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {},
      );
    }

    yShapes.observeDeep(handleChanges);
    return () => yShapes.unobserveDeep(handleChanges);
  }, []);

  useEffect(() => {
    function handleDisconnect() {
      provider.disconnect();
    }

    window.addEventListener("beforeunload", handleDisconnect);
    return () => window.removeEventListener("beforeunload", handleDisconnect);
  }, []);

  return {
    onMount,
    onChangePage,
    onUndo,
    onRedo,
    onChangePresence,
  };
}
