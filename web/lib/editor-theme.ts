import * as monaco from 'monaco-editor';

import {
  CSS_VARIABLE_PREFIX,
  EDITOR_BACKGROUND_VARIABLE,
  EDITOR_BASE_THEME,
  EDITOR_COLORS,
  EDITOR_SYNTAX_RULES,
  EDITOR_THEME_NAME,
} from '@/config/editor';

// The canvas reports translucent colors in this form, e.g. "rgba(255, 255, 255, 0.07)".
const RGBA_PATTERN = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/;

function isCssVariable(value: string): boolean {
  return value.startsWith(CSS_VARIABLE_PREFIX);
}

function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

// Monaco only accepts #RRGGBB or #RRGGBBAA, but the production build rewrites token values
// (#000000 becomes #000). A canvas turns any CSS color into one of two predictable forms.
function createColorNormalizer(): (value: string) => string | null {
  const context = document.createElement('canvas').getContext('2d');

  return (value) => {
    if (!context || !CSS.supports('color', value)) return null;
    context.fillStyle = value;
    const normalized = context.fillStyle;
    if (typeof normalized !== 'string') return null;
    if (normalized.startsWith('#')) return normalized;

    const match = RGBA_PATTERN.exec(normalized);
    if (!match) return null;
    const [red, green, blue] = [match[1], match[2], match[3]].map(Number);
    const alpha = Number(match[4] ?? 1);
    if (red === undefined || green === undefined || blue === undefined) return null;
    return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}${toHexByte(alpha * 255)}`;
  };
}

const HEX_BYTE_PATTERN = /[0-9a-f]{2}/gi;
const OPAQUE_HEX_LENGTH = 7;

// Monaco drops the alpha of syntax colors, which would turn Cursor's translucent text colors
// (secondary text is the foreground at 60 percent) into full-strength text. Blending the
// color over the editor background first gives the color the eye would see.
function flattenOver(color: string, background: string): string {
  if (color.length <= OPAQUE_HEX_LENGTH) return color;
  const [red = 0, green = 0, blue = 0, alpha = 255] = (color.match(HEX_BYTE_PATTERN) ?? []).map(
    (byte) => Number.parseInt(byte, 16),
  );
  const [baseRed = 0, baseGreen = 0, baseBlue = 0] = (background.match(HEX_BYTE_PATTERN) ?? []).map(
    (byte) => Number.parseInt(byte, 16),
  );
  const opacity = alpha / 255;
  const mix = (top: number, base: number) => toHexByte(top * opacity + base * (1 - opacity));
  return `#${mix(red, baseRed)}${mix(green, baseGreen)}${mix(blue, baseBlue)}`;
}

// Monaco cannot read CSS variables, so the tokens are resolved here.
function readTokens(variables: string[]): Map<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const normalize = createColorNormalizer();
  const tokens = new Map<string, string>();
  for (const variable of variables) {
    const color = normalize(styles.getPropertyValue(variable).trim());
    if (color) tokens.set(variable, color);
  }
  return tokens;
}

export function applyEditorTheme(): void {
  const variables = [
    EDITOR_BACKGROUND_VARIABLE,
    ...EDITOR_SYNTAX_RULES.map((rule) => rule.variable),
    ...Object.values(EDITOR_COLORS).filter(isCssVariable),
  ];
  const tokens = readTokens([...new Set(variables)]);

  const background = tokens.get(EDITOR_BACKGROUND_VARIABLE);
  const rules: monaco.editor.ITokenThemeRule[] = [];
  for (const rule of EDITOR_SYNTAX_RULES) {
    const color = tokens.get(rule.variable);
    if (!color) continue;
    const foreground = background ? flattenOver(color, background) : color;
    rules.push({ token: rule.token, foreground: foreground.slice(1), fontStyle: rule.fontStyle });
  }

  const colors: Record<string, string> = {};
  for (const [id, value] of Object.entries(EDITOR_COLORS)) {
    const color = isCssVariable(value) ? tokens.get(value) : value;
    if (color) colors[id] = color;
  }

  monaco.editor.defineTheme(EDITOR_THEME_NAME, {
    base: EDITOR_BASE_THEME,
    inherit: true,
    rules,
    colors,
  });
  monaco.editor.setTheme(EDITOR_THEME_NAME);
}
