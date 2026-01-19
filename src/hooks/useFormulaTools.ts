import { useCallback } from "react";
import {
  TldrawApp,
  TDShape,
  TDShapeType,
  TDAsset,
  TDAssetType,
} from "@tldraw/tldraw";
import { doc, yShapes, yAssets } from "../store";
import { formulaToCanvas } from "../utils/formulaConverter";

export interface FormulaData {
  formula: string;
}

const generateId = () =>
  `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useFormulaTools = () => {
  // Добавляет новую формулу на холст как изображение
  const addFormula = useCallback(
    async (app: TldrawApp, formula: string = "x^2 + y^2 = z^2") => {
      if (!app) return;

      try {
        // Конвертируем формулу в изображение
        const imageDataUrl = await formulaToCanvas(formula);

        const center = {
          x: app.viewport.width / 2,
          y: app.viewport.height / 2,
        };

        const assetId = generateId();
        const shapeId = generateId();

        // Создаём Asset для изображения
        const asset: TDAsset = {
          id: assetId,
          type: TDAssetType.Image,
          src: imageDataUrl,
          fileName: "formula.png",
          size: [600, 200],
        };

        // Добавляем Asset в Yjs
        doc.transact(() => {
          yAssets.set(assetId, asset);
        });

        // Небольшая пауза для надёжности
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Получаем стиль по умолчанию из приложения
        const defaultStyle =
          app.getPageState().selectedIds.length > 0
            ? app.getShape(app.getPageState().selectedIds[0])?.style
            : { color: "black", size: "medium", dash: "draw", scale: "1" };

        // Создаём Shape - изображение с правильным стилем
        const newShape: TDShape = {
          id: shapeId,
          name: "Formula",
          parentId: app.currentPageId,
          type: TDShapeType.Image,
          point: [center.x - 300, center.y - 100],
          size: [600, 200],
          rotation: 0,
          isLocked: false,
          isHidden: false,
          isFinished: true,
          assetId: assetId,
          style: defaultStyle as any,
          meta: {
            isFormula: true,
            formula: formula,
          } as any,
        } as any;

        // Добавляем Shape в Yjs
        doc.transact(() => {
          yShapes.set(newShape.id, newShape);
        });

        // Выбираем новую форму и даём время на синхронизацию
        await new Promise((resolve) => setTimeout(resolve, 50));
        app.select(newShape.id);
      } catch (error) {
        console.error("Error adding formula:", error);
        alert(`Ошибка при добавлении формулы: ${error}`);
      }
    },
    [],
  );

  // Обновляет формулу
  const updateFormula = useCallback(
    async (app: TldrawApp, shapeId: string, formula: string) => {
      if (!app) return;

      try {
        const shape = yShapes.get(shapeId);
        if (!shape || shape.type !== TDShapeType.Image) return;

        // Конвертируем новую формулу
        const imageDataUrl = await formulaToCanvas(formula);
        const assetId = generateId();

        // Создаём новый Asset
        const asset: TDAsset = {
          id: assetId,
          type: TDAssetType.Image,
          src: imageDataUrl,
          fileName: "formula.png",
          size: [600, 200],
        };

        // Добавляем задержку для надёжности
        await new Promise((resolve) => setTimeout(resolve, 100));

        doc.transact(() => {
          yAssets.set(assetId, asset);
          // Сохраняем существующий style или используем дефолтный
          const styleToUse = shape.style || {
            color: "black",
            size: "medium",
            dash: "draw",
            scale: "1",
          };
          yShapes.set(shapeId, {
            ...shape,
            assetId: assetId,
            style: styleToUse as any,
            meta: {
              isFormula: true,
              formula: formula,
            } as any,
          } as any);
        });
      } catch (error) {
        console.error("Error updating formula:", error);
        alert(`Ошибка при обновлении формулы: ${error}`);
      }
    },
    [],
  );

  return {
    addFormula,
    updateFormula,
  };
};
