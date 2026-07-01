export type ThemeId = 'retro' | 'dining' | 'minimal' | 'party';

export const THEME_ORDER: ThemeId[] = ['retro', 'dining', 'minimal', 'party'];

// 「店家氛圍」四主題的中繼資料（名稱、描述、切換器色票）
export const THEMES: Record<ThemeId, { name: string; desc: string; swatch: string }> = {
  retro: { name: '復古懷舊', desc: '霓虹夜店', swatch: 'linear-gradient(135deg,#ff2e9a,#23e3ff)' },
  dining: { name: '餐桌氛圍', desc: '燭光暖橘', swatch: 'linear-gradient(135deg,#f0a24c,#ef6a35)' },
  minimal: { name: '極簡現代', desc: '留白俐落', swatch: 'linear-gradient(135deg,#e8e8ef,#4f46e5)' },
  party: { name: '歡樂聚會', desc: '繽紛派對', swatch: 'linear-gradient(135deg,#7c3aed,#ff7a45)' },
};
