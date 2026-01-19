import React, { useEffect, useRef } from 'react';
// @ts-ignore
import katex from 'katex';

interface FormulaRendererProps {
  formula: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Компонент для отображения математических формул с использованием KaTeX
 */
export const FormulaRenderer: React.FC<FormulaRendererProps> = ({
  formula,
  width = 200,
  height = 100,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !formula) return;

    try {
      const html = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
      containerRef.current.innerHTML = html;
      containerRef.current.style.color = '#333';
    } catch (error) {
      console.error('KaTeX rendering error:', error);
      containerRef.current.innerHTML = `<span style="color: red; font-size: 12px;">Ошибка в формуле</span>`;
    }
  }, [formula]);

  return (
    <div
      ref={containerRef}
      className={`formula-renderer ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '4px',
        overflow: 'auto',
        border: '1px solid #e0e0e0',
      }}
      title={formula}
    />
  );
};

export default FormulaRenderer;
