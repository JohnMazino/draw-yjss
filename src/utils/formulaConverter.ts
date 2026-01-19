// @ts-ignore
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Рендер формулы в Canvas и возврат Data URL
 */
export async function formulaToCanvas(formula: string): Promise<string> {
  try {
    // Рендерим KaTeX в HTML
    const mathHtml = katex.renderToString(formula, {
      throwOnError: false,
      displayMode: true,
    });

    // Создаём контейнер с формулой
    const container = document.createElement('div');
    container.id = `formula-render-${Date.now()}`;
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    container.style.backgroundColor = 'white';
    container.style.padding = '115px 115px';
    container.style.display = 'inline-block';
    container.style.fontSize = '40px';
    container.style.whiteSpace = 'normal';
    container.style.maxWidth = '900px';
    container.style.overflow = 'visible';
    container.style.lineHeight = '1.4';
    container.innerHTML = mathHtml;
    document.body.appendChild(container);

    // Даём время на загрузку шрифтов
    await new Promise(resolve => setTimeout(resolve, 300));

    // Динамически загружаем html2canvas
    const html2canvas = (await import('html2canvas')).default;

    // Ограничиваем размеры контейнера для гарантированного умещения
    const boundingRect = container.getBoundingClientRect();
    const maxWidth = Math.min(boundingRect.width, 1000);
    const maxHeight = Math.min(boundingRect.height, 450);
    
    // Конвертируем HTML в Canvas через html2canvas
    const canvas = await html2canvas(container, {
      backgroundColor: 'white',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 5000,
      width: maxWidth,
      height: maxHeight,
    });

    // Удаляем контейнер
    document.body.removeChild(container);

    // Конвертируем Canvas в PNG Data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error converting formula to canvas:', error);
    // Fallback: возвращаем простую текстовую версию
    return createFallbackCanvas(formula);
  }
}

/**
 * Fallback функция - рендерит текст если html2canvas не сработал
 */
function createFallbackCanvas(formula: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 250;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Белый фон
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Текст
  ctx.fillStyle = 'black';
  ctx.font = 'italic 36px "Cambria Math", Cambria, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formula, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/png');
}
