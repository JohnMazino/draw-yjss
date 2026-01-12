import {
  TDBinding,
  TDShape,
  TDUser,
  TldrawApp,
  TDAssetType,
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

// функция загрузки
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

  if (!res.ok) throw new Error("Upload failed");
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
      const promises = Object.values(shapes)
        .filter((shape): shape is TDShape => !!shape)
        .filter(
          (shape) =>
            ((shape.type === "image" || shape.type === "video") &&
              shape.props.src?.startsWith("blob:")) ||
            shape.props.src?.startsWith("data:"),
        )
        .map(async (shape) => {
          try {
            // Получаем blob из локального src (tldraw хранит его в assets?)
            // В v1 часто нужно взять из app.assets или из shape (если base64)
            let file: Blob;
            if (shape.props.src.startsWith("data:")) {
              const base64 = shape.props.src.split(",")[1];
              const byteString = atob(base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              file = new Blob([ab], { type: shape.props.mimeType });
            } else {
              // blob: URL — fetch'им
              const response = await fetch(shape.props.src);
              file = await response.blob();
            }

            const newUrl = await uploadToMyServer(file);
            // Обновляем shape в Yjs
            doc.transact(() => {
              const updatedShape = {
                ...shape,
                props: { ...shape.props, src: newUrl },
              };
              yShapes.set(shape.id, updatedShape);
            });

            // Опционально: обнови в app сразу
            app?.patchCreate([updatedShape]);
          } catch (err) {
            console.error("Ошибка загрузки ассета:", err);
          }
        });
      await Promise.all(promises);
    },
    [],
  );

  const onUndo = useCallback(() => {
    undoManager.undo();
  }, []);

  const onRedo = useCallback(() => {
    undoManager.redo();
  }, []);

  /**
   * Callback to update user's (self) presence
   */
  const onChangePresence = useCallback((app: TldrawApp, user: TDUser) => {
    awareness.setLocalStateField("tdUser", user);
  }, []);

  /**
   * Update app users whenever there is a change in the room users
   */
  useEffect(() => {
    const onChangeAwareness = () => {
      const tldraw = tldrawRef.current;

      if (!tldraw || !tldraw.room) return;

      const others = Array.from(awareness.getStates().entries())
        .filter(([key, _]) => key !== awareness.clientID)
        .map(([_, state]) => state)
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
