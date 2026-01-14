// App.tsx
import {
  Tldraw,
  useFileSystem,
  TldrawApp,
  TDAsset,
  TDAssetType,
} from "@tldraw/tldraw";
import { useUsers } from "y-presence";
import { useMultiplayerState } from "./hooks/useMultiplayerState";
import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import { awareness, doc, roomID, yAssets } from "./store";

// Создаем кастомный компонент с русским языком
function Editor({ roomId }: { roomId: string }) {
  const fileSystemEvents = useFileSystem();
  const { onMount, ...events } = useMultiplayerState(roomId);
  const [app, setApp] = useState<TldrawApp | null>(null);

  // Устанавливаем русский язык при загрузке
  useEffect(() => {
    if (app) {
      // Нужно найти элемент кнопки русского языка и кликнуть на него
      setTimeout(() => {
        const ruButton = document.getElementById("TD-MenuItem-Language-ru");
        if (ruButton) {
          // Убираем галочку с английского
          const enButton = document.getElementById("TD-MenuItem-Language-en");
          if (enButton) {
            enButton.setAttribute("aria-checked", "false");
            enButton.setAttribute("data-state", "unchecked");
          }

          // Ставим галочку на русский
          ruButton.setAttribute("aria-checked", "true");
          ruButton.setAttribute("data-state", "checked");

          // Обновляем язык в приложении
          app.setSetting("language", "ru");
        }
      }, 100);
    }
  }, [app]);

  const handleMount = useCallback(
    (appInstance: TldrawApp) => {
      setApp(appInstance);

      // Применяем русские настройки сразу
      appInstance.setSetting("language", "ru");

      // Если есть оригинальный обработчик, вызываем его
      if (onMount) {
        onMount(appInstance);
      }
    },
    [onMount],
  );

  return (
    <Tldraw
      autofocus
      showPages={false}
      onMount={handleMount}
      showMenu={false}
      // {...fileSystemEvents}
      {...events}
      onAssetCreate={async (app: TldrawApp, file: File, id: string) => {
        console.log("onAssetCreate вызван! Файл:", file.name, "ID:", id);

        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(
            "https://draw-yjss-assets-production.up.railway.app/upload",
            {
              method: "POST",
              body: formData,
            },
          );

          if (!response.ok)
            throw new Error("Upload failed: " + response.status);

          const { url } = await response.json();
          console.log("Успешно загружено, URL:", url);

          const assetType = file.type.startsWith("video/")
            ? TDAssetType.Video
            : TDAssetType.Image;

          const asset = {
            id: id,
            type: assetType,
            src: url,
            fileName: file.name || "uploaded-file",
            size: [800, 600] as [number, number],
          } as TDAsset;

          doc.transact(() => {
            yAssets.set(id, asset);
          });

          return url;
        } catch (err) {
          console.error("Ошибка загрузки:", err);

          const dataUrl = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });

          const assetType = file.type.startsWith("video/")
            ? TDAssetType.Video
            : TDAssetType.Image;

          const asset = {
            id: id,
            type: assetType,
            src: dataUrl,
            fileName: file.name || "uploaded-file",
            size: [800, 600] as [number, number],
          } as TDAsset;

          doc.transact(() => {
            yAssets.set(id, asset);
          });

          return dataUrl;
        }
      }}
    />
  );
}

function Info() {
  const users = useUsers(awareness);

  return (
    <div className="absolute p-md">
      <div className="flex space-between">
        <span>Подключено пользователей: {users.size}</span>
      </div>
    </div>
  );
}

export default function App() {
  // Применяем русский язык для всей страницы
  useEffect(() => {
    document.documentElement.lang = "ru";

    // Меняем язык в localStorage tldraw
    localStorage.setItem("tldraw_language", "ru");
    localStorage.setItem(
      "tldraw_settings",
      JSON.stringify({
        ...JSON.parse(localStorage.getItem("tldraw_settings") || "{}"),
        language: "ru",
      }),
    );
  }, []);

  return (
    <div className="tldraw custom-theme" lang="ru">
      <Info />
      <Editor roomId={roomID} />
    </div>
  );
}
