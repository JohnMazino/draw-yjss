import { useCallback, useEffect, useRef } from "react";
import {
  TDBinding,
  TDShape,
  TDUser,
  TldrawApp,
} from "@tldraw/tldraw";

import {
  awareness,
  doc,
  provider,
  undoManager,
  yAssets,
  yBindings,
  yShapes,
} from "../store";

export function useMultiplayerState(roomId: string) {
  const tldrawRef = useRef<TldrawApp>();

  // Основная функция синхронизации всего контента
  const syncContent = useCallback(() => {
    const app = tldrawRef.current;
    if (!app) return;

    app.replacePageContent(
      Object.fromEntries(yShapes.entries()),
      Object.fromEntries(yBindings.entries()),
      Object.fromEntries(yAssets.entries()),
      undefined,
    );
  }, []);

  // onMount
  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomId);
      app.pause();
      tldrawRef.current = app;

      // Первичная загрузка всего состояния из yjs
      syncContent();
    },
    [roomId, syncContent],
  );

  // Сохранение изменений локального пользователя в yjs
  const onChangePage = useCallback(
    (
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
    },
    [],
  );

  // Undo / Redo
  const onUndo = useCallback(() => undoManager.undo(), []);
  const onRedo = useCallback(() => undoManager.redo(), []);

  // Передача текущего пользователя в awareness 
  const onChangePresence = useCallback((app: TldrawApp, user: TDUser) => {
    awareness.setLocalStateField("tdUser", user);
  }, []);

  // Синхронизация пользователей (awareness)
  useEffect(() => {
    const onChangeAwareness = () => {
      const app = tldrawRef.current;
      if (!app || !app.room) return;

      const others = Array.from(awareness.getStates().entries())
        .filter(([key]) => key !== awareness.clientID)
        .map(([, state]) => state)
        .filter((state): state is { tdUser: TDUser } => !!state.tdUser);

      const remoteUserIds = others.map((s) => s.tdUser.id);

      // Удаляем пользователей, которые вышли
      Object.values(app.room.users).forEach((user) => {
        if (
          user &&
          !remoteUserIds.includes(user.id) &&
          user.id !== app.room?.userId
        ) {
          app.removeUser(user.id);
        }
      });

      // Обновляем список пользователей
      app.updateUsers(others.map((s) => s.tdUser));
    };

    awareness.on("change", onChangeAwareness);
    return () => awareness.off("change", onChangeAwareness);
  }, []);

  // Синхронизация содержимого при любом изменении yjs-карт
  useEffect(() => {
    // Первичная синхронизация (на случай, если что-то уже было в yjs)
    syncContent();

    yShapes.observeDeep(syncContent);
    yBindings.observeDeep(syncContent);
    yAssets.observeDeep(syncContent);

    return () => {
      yShapes.unobserveDeep(syncContent);
      yBindings.unobserveDeep(syncContent);
      yAssets.unobserveDeep(syncContent);
    };
  }, [syncContent]);

  // Отключение провайдера при уходе со страницы
  useEffect(() => {
    const handleDisconnect = () => {
      provider.disconnect();
    };

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