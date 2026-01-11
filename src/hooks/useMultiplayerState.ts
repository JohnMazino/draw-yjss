import { TDBinding, TDShape, TDUser, TldrawApp } from "@tldraw/tldraw";
import { useCallback, useEffect, useRef } from "react";
import {
  awareness,
  doc,
  provider,
  undoManager,
  yBindings,
  yShapes,
} from "../store";

// Генерация или получение roomID из URL
// Если URL — корень (/), создаём новый random ID и меняем адрес
let roomID = window.location.pathname.slice(1); // убираем ведущий /
if (!roomID) {
  roomID = crypto.randomUUID().slice(0, 8); // короткий ID, например abc12345
  history.replaceState({}, "", `/${roomID}`);
}

export function useMultiplayerState() {
  // roomId больше не нужен как параметр
  const tldrawRef = useRef<TldrawApp>();

  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomID);
      app.pause();
      tldrawRef.current = app;

      // Загружаем текущее состояние из Yjs
      app.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {},
      );
    },
    [], // roomID теперь глобальный, не зависит от пропсов
  );

  const onChangePage = useCallback(
    (
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>,
    ) => {
      undoManager.stopCapturing();
      doc.transact(() => {
        Object.entries(shapes).forEach(([id, shape]) => {
          if (!shape) yShapes.delete(id);
          else yShapes.set(shape.id, shape);
        });
        Object.entries(bindings).forEach(([id, binding]) => {
          if (!binding) yBindings.delete(id);
          else yBindings.set(binding.id, binding);
        });
      });
    },
    [],
  );

  const onUndo = useCallback(() => undoManager.undo(), []);
  const onRedo = useCallback(() => undoManager.redo(), []);

  const onChangePresence = useCallback((app: TldrawApp, user: TDUser) => {
    awareness.setLocalStateField("tdUser", user);
  }, []);

  // Остальной код (onChangeAwareness, observeDeep, disconnect) остаётся без изменений
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
