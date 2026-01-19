import React, { useEffect, useRef } from 'react';
// @ts-ignore
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaShapeProps {
  formula: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
}

export const FormulaShape: React.FC<FormulaShapeProps> = ({ 
  formula, 
  isEditing = false,
  onChange 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      return;
    }

    if (!containerRef.current || !formula) return;

    try {
      const html = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
      });
      containerRef.current.innerHTML = html;
    } catch (error) {
      containerRef.current.textContent = `Ошибка: ${formula}`;
    }
  }, [formula, isEditing]);

  if (isEditing) {
    return (
      <div className="formula-editor">
        <textarea
          ref={inputRef}
          value={formula}
          onChange={(e) => onChange?.(e.target.value)}
          className="formula-input"
          placeholder="Введите формулу (LaTeX)"
          style={{
            width: '100%',
            height: '100px',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            border: '2px solid #4a9eff',
            borderRadius: '4px',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="formula-display"
      style={{
        padding: '12px',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
};

export default FormulaShape;
