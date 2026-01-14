// App.tsx
import { Tldraw, useFileSystem, TldrawApp } from "@tldraw/tldraw";
import { useUsers } from "y-presence";
import { useMultiplayerState } from "./hooks/useMultiplayerState";
import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import { awareness, roomID } from "./store";

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
      {...fileSystemEvents}
      {...events}
      // Кастомная загрузка с правильной сигнатурой
      onAssetUpload={async (app: TldrawApp, file: File, id: string) => {
        console.log("Загрузка файла:", file.name);

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

          if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
          }

          const { url } = await response.json();

          // Возвращаем ТОЛЬКО URL (string) — tldraw сам обработает тип и id
          return url;
        } catch (err) {
          console.error("Ошибка загрузки:", err);

          // Fallback: base64 как URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
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
