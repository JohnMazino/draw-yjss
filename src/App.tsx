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
import { awareness, doc, roomID, yAssets, yBindings, yShapes } from "./store";
import { FormulaToolbar } from "./components/FormulaToolbar";

// Компонент редактора
function Editor({ roomId }: { roomId: string }) {
  const fileSystemEvents = useFileSystem();
  const { onMount, ...events } = useMultiplayerState(roomId);
  const [app, setApp] = useState<TldrawApp | null>(null);

  // Установка русского языка
  useEffect(() => {
    if (!app) return;
    app.setSetting("language", "ru");
  }, [app]);

  const handleMount = useCallback(
    (appInstance: TldrawApp) => {
      setApp(appInstance);
      appInstance.setSetting("language", "ru");

      if (onMount) {
        onMount(appInstance);
      }

      const preloadImages = () => {
        const assets = Object.fromEntries(yAssets.entries());
        console.log(`Предзагрузка ${Object.keys(assets).length} ассетов`);

        Object.values(assets).forEach((asset: TDAsset) => {
          if (asset.src && asset.src.startsWith("http")) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = asset.src;
            img.onload = () => console.log("Предзагружено:", asset.src);
            img.onerror = (e) => console.error("Ошибка предзагрузки:", asset.src, e);
          }
        });
      };

      preloadImages();

      const unsubscribe = yAssets.observeDeep(preloadImages);
      return unsubscribe;
    },
    [onMount],
  );

  // Загрузка ассета + определение реального размера 
  const onAssetCreate = useCallback(
    async (app: TldrawApp, file: File, id: string) => {
      console.log(`onAssetCreate: ${file.name} (id: ${id})`);

      // DataURL для мгновенного отображения (всегда)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let serverUrl: string | undefined;

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "https://draw-yjss-assets-production.up.railway.app/upload",
          { method: "POST", body: formData },
        );

        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

        const { url } = await response.json();
        serverUrl = url;
        console.log("Загружено на сервер:", url);
      } catch (err) {
        console.error("Ошибка загрузки на сервер:", err);
        // Продолжаем с dataUrl — хотя бы локально видно
      }

      // Определяем тип и размер
      const isVideo = file.type.startsWith("video/");
      const assetType = isVideo ? TDAssetType.Video : TDAssetType.Image;

      // Получаем реальные размеры
      const size = await new Promise<[number, number]>((resolve) => {
        if (isVideo) {
          const video = document.createElement("video");
          video.src = dataUrl;
          video.muted = true; // чтобы не играл звук при загрузке
          video.preload = "metadata";

          video.onloadedmetadata = () => {
            resolve([video.videoWidth || 800, video.videoHeight || 600]);
            video.remove();
          };

          video.onerror = () => {
            console.warn("Ошибка загрузки метаданных видео");
            resolve([800, 600]);
            video.remove();
          };
        } else {
          // Изображение
          const img = new Image();
          img.src = dataUrl;

          img.onload = () => {
            resolve([img.naturalWidth || 800, img.naturalHeight || 600]);
          };

          img.onerror = () => {
            console.warn("Ошибка загрузки изображения");
            resolve([800, 600]);
          };
        }
      });

      const asset: TDAsset = {
        id,
        type: assetType,
        src: serverUrl || dataUrl, // серверный URL в приоритете
        fileName: file.name || (isVideo ? "video.mp4" : "image.png"),
        size,
      };

      doc.transact(() => {
        yAssets.set(id, asset);
      });

      return dataUrl; // tldraw ждёт dataURL для быстрого рендера
    },
    [],
  );

  return (
    <>
      <Tldraw
        autofocus
        showPages={false}
        onMount={handleMount}
        showMenu={false}
        {...events}
        onAssetCreate={onAssetCreate}
      />
      <FormulaToolbar app={app} />
    </>
  );
}

// Информация о пользователях
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
  useEffect(() => {
    document.documentElement.lang = "ru";
    localStorage.setItem("tldraw_language", "ru");

    const settings = JSON.parse(localStorage.getItem("tldraw_settings") || "{}");
    localStorage.setItem(
      "tldraw_settings",
      JSON.stringify({ ...settings, language: "ru" }),
    );
  }, []);

  return (
    <div className="tldraw custom-theme h-screen w-screen" lang="ru">
      <Info />
      <Editor roomId={roomID} />
    </div>
  );
}