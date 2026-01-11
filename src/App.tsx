// App.tsx
import { Tldraw, useFileSystem } from "@tldraw/tldraw";
import { useUsers } from "y-presence";
import { useMultiplayerState } from "./hooks/useMultiplayerState";
import { useEffect } from "react";
import "./styles.css";
import { awareness, roomID } from "./store";

// Генерация или получение roomID из URL (один раз при загрузке страницы)
let currentRoomID = window.location.pathname.slice(1);
if (!currentRoomID) {
  currentRoomID = crypto.randomUUID().slice(0, 8);
  history.replaceState({}, "", `/${currentRoomID}`);
}

function Editor() {
  const fileSystemEvents = useFileSystem();
  const { onMount, onChangePage, onUndo, onRedo, onChangePresence } =
    useMultiplayerState(); // Теперь без параметра roomId

  // Принудительно устанавливаем русский язык при монтировании
  useEffect(() => {
    // Даём время на рендер меню
    const timer = setTimeout(() => {
      const ruButton = document.getElementById("TD-MenuItem-Language-ru");
      if (ruButton) {
        // Убираем галочку с английского
        const enButton = document.getElementById("TD-MenuItem-Language-en");
        if (enButton) {
          enButton.setAttribute("aria-checked", "false");
          enButton.setAttribute("data-state", "unchecked");
        }

        // Ставим галочку на русский и имитируем клик
        ruButton.setAttribute("aria-checked", "true");
        ruButton.setAttribute("data-state", "checked");
        ruButton.click(); // ← самый надёжный способ переключить язык
      }
    }, 800); // 800 мс — чтобы меню точно появилось

    return () => clearTimeout(timer);
  }, []);

  return (
    <Tldraw
      autofocus
      showPages={false}
      showMenu={false}
      onMount={onMount}
      onChangePage={onChangePage}
      onUndo={onUndo}
      onRedo={onRedo}
      onChangePresence={onChangePresence}
      {...fileSystemEvents}
    />
  );
}

function Info() {
  const users = useUsers(awareness);
  return (
    <div className="absolute p-md" style={{ zIndex: 1000 }}>
      <div className="flex space-between">
        <span>Подключено пользователей: {users.size}</span>
      </div>
    </div>
  );
}

export default function App() {
  // Глобальные настройки языка для всей страницы
  useEffect(() => {
    // Устанавливаем lang на html
    document.documentElement.lang = "ru";

    // Принудительно сохраняем русский в localStorage (на всякий случай)
    localStorage.setItem("tldraw_language", "ru");

    // Обновляем настройки tldraw, если они есть
    const settings = JSON.parse(
      localStorage.getItem("tldraw_settings") || "{}",
    );
    localStorage.setItem(
      "tldraw_settings",
      JSON.stringify({ ...settings, language: "ru" }),
    );
  }, []);

  return (
    <div className="tldraw custom-theme" lang="ru">
      <Info />
      <Editor />
    </div>
  );
}
