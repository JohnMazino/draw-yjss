import React, { useState, useRef, useEffect } from 'react';
import { TldrawApp } from '@tldraw/tldraw';
import { useFormulaTools } from '../hooks/useFormulaTools';
import './FormulaToolbar.css';
// @ts-ignore
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaToolbarProps {
  app: TldrawApp | null;
}

const LATEX_COMMANDS = [
  // Дроби и корни
  '\\frac{a}{b}', '\\sqrt{x}', '\\sqrt[n]{x}',
  // Степени и индексы
  '^', '_', '\\^',
  // Операторы
  '\\pm', '\\mp', '\\times', '\\div', '\\cdot',
  // Интегралы и суммы
  '\\int', '\\iint', '\\iiint', '\\oint', '\\sum', '\\prod',
  // Пределы
  '\\lim', '\\to', '\\infty',
  // Греческие буквы
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\pi',
  // Матрицы
  '\\begin{matrix}', '\\end{matrix}',
  // Скобки
  '\\left(', '\\right)', '\\left[', '\\right]', '\\left\\{', '\\right\\}',
  // Функции
  '\\sin', '\\cos', '\\tan', '\\log', '\\ln', '\\exp',
  // Стрелки
  '\\rightarrow', '\\leftarrow', '\\Rightarrow', '\\Leftarrow',
];

export const FormulaToolbar: React.FC<FormulaToolbarProps> = ({ app }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { addFormula } = useFormulaTools();

  // Обновление предпросмотра
  useEffect(() => {
    if (!formulaInput.trim()) {
      setPreviewHtml('');
      setPreviewError(false);
      return;
    }

    try {
      const html = katex.renderToString(formulaInput, {
        throwOnError: true,
        displayMode: true,
      });
      setPreviewHtml(html);
      setPreviewError(false);
    } catch (error) {
      setPreviewHtml('');
      setPreviewError(true);
    }
  }, [formulaInput]);

  const commonFormulas = [
    { label: 'Квадратное уравнение', formula: 'ax^2 + bx + c = 0' },
    { label: 'Дискриминант', formula: 'D = b^2 - 4ac' },
    { label: 'Пифагор', formula: 'a^2 + b^2 = c^2' },
    { label: 'Корни квадратного', formula: 'x = \\frac{-b \\pm \\sqrt{D}}{2a}' },
    { label: 'Производная', formula: 'f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}' },
    { label: 'Интеграл', formula: '\\int_{a}^{b} f(x)dx = F(b) - F(a)' },
    { label: 'Эйлер', formula: 'e^{i\\pi} + 1 = 0' },
    { label: 'Вероятность', formula: 'P(A) = \\frac{n(A)}{n(\\Omega)}' },
  ];

  // Обработка ввода и автодополнение
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormulaInput(value);

    // Проверка на \ для показа подсказок
    const lastBackslash = value.lastIndexOf('\\');
    if (lastBackslash !== -1) {
      const afterBackslash = value.substring(lastBackslash);
      const filtered = LATEX_COMMANDS.filter(cmd => 
        cmd.startsWith(afterBackslash) && cmd !== afterBackslash
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Вставка предложения
  const insertSuggestion = (suggestion: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lastBackslash = formulaInput.lastIndexOf('\\');
    const before = formulaInput.substring(0, lastBackslash);
    const after = formulaInput.substring(start);

    setFormulaInput(before + suggestion + after);
    setShowSuggestions(false);
    setSuggestions([]);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = before.length + suggestion.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (showSuggestions) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && !e.ctrlKey) {   // ← убрал лишнее условие
      e.preventDefault();
      insertSuggestion(suggestions[selectedSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
    // Больше НЕ добавляем PageUp/PageDown и НЕ дублируем ArrowUp/Down
  } else if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    handleAddFormula();
  }
};
// Прокрутка подсказок к выделенному элементу
useEffect(() => {
  if (!showSuggestions || suggestions.length === 0 || !suggestionsRef.current) return;

  const container = suggestionsRef.current;
  const selected = container.children[selectedSuggestion] as HTMLElement | undefined;

  if (selected) {
    selected.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }
}, [selectedSuggestion, showSuggestions, suggestions.length]);

  // Добавление формулы на холст
  const handleAddFormula = async () => {
    if (app && formulaInput.trim()) {
      setIsLoading(true);
      try {
        await addFormula(app, formulaInput);
        setFormulaInput('');
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Быстрое добавление из шаблона
  const handleQuickFormula = async (formula: string) => {
    if (app) {
      setIsLoading(true);
      try {
        await addFormula(app, formula);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }
  };
  // Рендеринг компонента
  return (
    <div className="formula-toolbar" style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {isOpen && (
        <div className="formula-menu" style={{
          position: 'absolute',
          bottom: '70px',
          right: '0',
          backgroundColor: '#1e1e1e',
          border: '1px solid #333',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          width: '500px',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Заголовок */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #333',
            backgroundColor: '#262626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#e0e0e0' }}>
              ∫ Математические формулы
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowHelp(!showHelp)}
                title="Справка"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 8px',
                  color: showHelp ? '#4a9eff' : '#999',
                  transition: 'color 0.2s',
                }}
              >
                ?
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 8px',
                  color: '#999',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Содержимое */}
          <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            gap: '1px',
            backgroundColor: '#1a1a1a',
          }}>
            {showHelp ? (
              /* Справка */
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
                fontSize: '12px',
                backgroundColor: '#1e1e1e',
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#e0e0e0' }}>Синтаксис LaTeX:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Степени</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`x^2 + y^2`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Индексы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`a_1, a_2, a_n`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Дроби</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\frac{a}{b}`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Корни</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\sqrt{x}, \\sqrt[3]{8}`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Интегралы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\int_a^b f(x)dx`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Суммы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\sum_{i=1}^n i`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Произведения</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\prod_{i=1}^n a_i`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Пределы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\lim_{x \\to 0}`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Греческие буквы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\alpha \\beta \\gamma`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Греческие буквы 2</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\delta \\pi \\theta`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Операции</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\pm \\mp \\times \\div`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Стрелки</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\to \\Rightarrow \\leftarrow`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Функции</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\sin \\cos \\tan \\log`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Матрицы</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\begin{matrix} a & b \\\\ c & d \\end{matrix}`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Скобки</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\left( ... \\right)`}</code>
                  </div>
                  <div>
                    <strong style={{ color: '#4a9eff' }}>Отрицание</strong>
                    <code style={{ display: 'block', fontSize: '10px', color: '#999' }}>{`\\not= \\neq`}</code>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Левая часть - ввод */}
                <div style={{
                  flex: 1,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'auto',
                  backgroundColor: '#1e1e1e',
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#e0e0e0',
                  }}>
                    Формула (LaTeX):
                  </label>
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <textarea
                      ref={textareaRef}
                      value={formulaInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Напишите формулу, можете начать с обратного слэша \"
                      style={{
                        width: '100%',
                        height: '80px',
                        padding: '10px',
                        fontFamily: 'Menlo, Monaco, Courier New, monospace',
                        fontSize: '12px',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        resize: 'none',
                        boxSizing: 'border-box',
                        fontWeight: 500,
                        lineHeight: '1.4',
                        backgroundColor: '#2d2d2d',
                        color: '#e0e0e0',
                      }}
                    />
                    
                    {/* Подсказки */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div
                        ref={suggestionsRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                          right: '0',
                          marginTop: '4px',
                          backgroundColor: '#2d2d2d',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 10,
                          maxHeight: '320px',      
                          overflowY: 'auto',            
                        }}
                      >
                        {suggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            onClick={() => insertSuggestion(suggestion)}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: idx === selectedSuggestion ? '#3d5a80' : 'transparent',
                              borderBottom: idx < suggestions.length - 1 ? '1px solid #3d3d3d' : 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontFamily: 'Menlo, Monaco, monospace',
                              color: idx === selectedSuggestion ? '#4a9eff' : '#999',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={() => setSelectedSuggestion(idx)}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Кнопка добавления */}
                  <button
                    onClick={handleAddFormula}
                    disabled={!formulaInput.trim() || isLoading}
                    style={{
                      padding: '10px',
                      backgroundColor: (formulaInput.trim() && !isLoading) ? '#4a9eff' : '#444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (formulaInput.trim() && !isLoading) ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      marginBottom: '12px',
                    }}
                  >
                    {isLoading ? 'Добавление...' : 'Добавить на холст'}
                  </button>

                  {/* Популярные формулы */}
                  <p style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#999',
                    margin: '8px 0 8px 0',
                  }}>
                    Шаблоны:
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}>
                    {commonFormulas.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickFormula(item.formula)}
                        disabled={isLoading}
                        title={item.label}
                        style={{
                          padding: '8px',
                          fontSize: '11px',
                          backgroundColor: '#2d2d2d',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          opacity: isLoading ? 0.6 : 1,
                          fontWeight: '500',
                          color: '#e0e0e0',
                        }}
                        onMouseEnter={(e) => {
                          if (!isLoading) {
                            const btn = e.target as HTMLButtonElement;
                            btn.style.backgroundColor = '#3d5a80';
                            btn.style.borderColor = '#4a9eff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          const btn = e.target as HTMLButtonElement;
                          btn.style.backgroundColor = '#2d2d2d';
                          btn.style.borderColor = '#444';
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Правая часть - предпросмотр */}
                <div style={{
                  flex: 1,
                  padding: '16px',
                  borderLeft: '1px solid #333',
                  backgroundColor: '#252525',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'auto',
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    color: '#e0e0e0',
                  }}>
                    Предпросмотр:
                  </label>
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: previewError ? '2px solid #ff6b6b' : '1px solid #ddd',
                    minHeight: '240px',
                    maxHeight: '350px',
                    overflow: 'hidden',
                    fontSize: '18px',
                    color: '#000000',
                  }}>
                    {!formulaInput.trim() ? (
                      <div style={{ color: '#ccc', fontSize: '14px' }}>Введите формулу</div>
                    ) : previewError ? (
                      <div style={{ color: '#ff6b6b', fontSize: '12px' }}>
                        Ошибка в синтаксисе
                      </div>
                    ) : (
                      <div style={{ 
                        color: '#000000', 
                        filter: 'none',
                        fontWeight: 'bold',
                        lineHeight: '1.8',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Кнопка инструмента */}
      <button
  className={`formula-btn ${isOpen ? 'open' : ''}`}
  onClick={() => setIsOpen(!isOpen)}
      >
        ∫
      </button>
    </div>
  );
};

export default FormulaToolbar;
