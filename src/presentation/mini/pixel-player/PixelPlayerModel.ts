export const PIXEL_DIRECTIONS = ['FRONT', 'FRONT_LEFT', 'LEFT', 'BACK_LEFT', 'BACK', 'BACK_RIGHT', 'RIGHT', 'FRONT_RIGHT'] as const;
export type PixelDirectionBucket = typeof PIXEL_DIRECTIONS[number];
export type PixelHand = 'R' | 'L';
export type PixelAction = 'idle' | 'batting' | 'pitching' | 'running' | 'fielding' | 'bunt_show' | 'bunt_hold' | 'bunt_contact' | 'bunt_pullback';
export type PixelPoint = Readonly<{ x: number; y: number }>;
export type PixelBounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PixelPart = Readonly<{ name: string; mirrorSafe: boolean; rows: readonly string[] }>;
export type PixelBatMetadata = Readonly<{ grip: PixelPoint; tip: PixelPoint; corridor: PixelBounds }>;
export type PixelFrame = Readonly<{
  id: string; action: PixelAction; direction: PixelDirectionBucket; hand: PixelHand;
  phase?: 0 | 1 | 2 | 3;
  anchors: Readonly<{ root: PixelPoint }>;
  bodyBounds: PixelBounds;
  bat?: PixelBatMetadata;
  parts: readonly PixelPart[];
}>;
export type PixelPlayerAsset = Readonly<{
  version: 1; id: string;
  canvas: Readonly<{ width: number; height: number }>;
  referenceHeight?: number;
  palette: Readonly<Record<string, string>>;
  frames: readonly PixelFrame[];
  compact?: PixelPlayerAsset;
}>;
export type CompiledPixelFrame = PixelFrame & Readonly<{ rgba: readonly number[]; visibleBatCells: readonly PixelPoint[] }>;
export type CompiledPixelAsset = Readonly<{ version: 1; id: string; width: number; height: number; referenceHeight?: number; frames: readonly CompiledPixelFrame[]; compact?: CompiledPixelAsset }>;
export type PixelPlayerPresentationProfile = Readonly<{
  playerId: string; bodyProfileId: string; uniformProfileId: string;
  handedness?: PixelHand; throws?: PixelHand; authoredAssetId: string;
  appearanceVariantId?: string;
}>;
