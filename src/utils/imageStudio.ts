export type ImageStudioProductMode = "single" | "bundle" | "variants";

export type ImageStudioSalesRegion =
  | "us"
  | "eu"
  | "uk"
  | "jp"
  | "kr"
  | "cn"
  | "sea"
  | "me"
  | "latam"
  | "br";

export type ImageStudioImageType =
  | "main"
  | "features"
  | "closeup"
  | "dimensions"
  | "lifestyle"
  | "packaging"
  | "comparison"
  | "lifestyle2"
  | "scene_a"
  | "scene_b";

export type ImageStudioLanguage =
  | "zh"
  | "en"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ru"
  | "ar"
  | "th";

export interface ImageStudioStatus {
  status: string;
  message: string;
  url: string;
  projectPath: string;
  port: number;
  ready: boolean;
}

export interface ImageStudioConfig {
  analyzeModel: string;
  analyzeApiKey: string;
  analyzeBaseUrl: string;
  generateModel: string;
  generateApiKey: string;
  generateBaseUrl: string;
}

export interface ImageStudioAnalysis {
  productName: string;
  category: string;
  sellingPoints: string[];
  materials: string;
  colors: string;
  targetAudience: string[];
  usageScenes: string[];
  estimatedDimensions: string;
}

export interface ImageStudioPlan {
  imageType: string;
  prompt: string;
  title?: string;
  headline?: string;
  subheadline?: string;
  [key: string]: unknown;
}

export interface ImageStudioGeneratedImage {
  imageType: string;
  imageUrl: string;
  variantId?: string;
  prompt?: string;
  suggestion?: string;
  createdAt?: number;
  active?: boolean;
}

export interface ImageStudioHistorySummary {
  id: string;
  timestamp: number;
  productName: string;
  salesRegion: string;
  imageCount: number;
}

export interface ImageStudioHistoryItem extends ImageStudioHistorySummary {
  images: ImageStudioGeneratedImage[];
}

export interface ImageStudioImageScore {
  clarity: number;
  composition: number;
  textQuality: number;
  compliance: number;
  appeal: number;
  overall: number;
  suggestions: string[];
}

export interface NativeImagePayload {
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
}

export const IMAGE_TYPE_LABELS: Record<string, string> = {
  main: "主图",
  features: "卖点图",
  closeup: "细节图",
  dimensions: "尺寸图",
  lifestyle: "场景图",
  packaging: "包装图",
  comparison: "对比图",
  lifestyle2: "A+ 收束图",
  scene_a: "核价场景图 A",
  scene_b: "核价场景图 B",
};

export const DEFAULT_IMAGE_TYPES: ImageStudioImageType[] = [
  "main",
  "features",
  "closeup",
  "dimensions",
  "lifestyle",
  "packaging",
  "comparison",
  "lifestyle2",
  "scene_a",
  "scene_b",
];

export const PRODUCT_MODE_OPTIONS = [
  { value: "single", label: "单品", description: "多张图是同一个商品" },
  { value: "bundle", label: "组合套装", description: "多张图是同一套售卖组合" },
  { value: "variants", label: "多规格", description: "多张图是同款不同颜色或规格" },
] as const;

export const SALES_REGION_OPTIONS = [
  { value: "us", label: "美国 / USA" },
  { value: "eu", label: "欧洲 / Europe" },
  { value: "uk", label: "英国 / UK" },
  { value: "jp", label: "日本 / Japan" },
  { value: "kr", label: "韩国 / Korea" },
  { value: "cn", label: "中国 / China" },
  { value: "sea", label: "东南亚 / Southeast Asia" },
  { value: "me", label: "中东 / Middle East" },
  { value: "latam", label: "拉美 / Latin America" },
  { value: "br", label: "巴西 / Brazil" },
] as const;

export const IMAGE_LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "th", label: "Thai" },
] as const;

export const IMAGE_SIZE_OPTIONS = [
  { value: "800x800", label: "800 x 800" },
  { value: "1000x1000", label: "1000 x 1000" },
  { value: "1200x1200", label: "1200 x 1200" },
  { value: "1600x1600", label: "1600 x 1600" },
] as const;

export const EMPTY_IMAGE_STUDIO_CONFIG: ImageStudioConfig = {
  analyzeModel: "",
  analyzeApiKey: "",
  analyzeBaseUrl: "",
  generateModel: "",
  generateApiKey: "",
  generateBaseUrl: "",
};

export const EMPTY_IMAGE_STUDIO_ANALYSIS: ImageStudioAnalysis = {
  productName: "",
  category: "",
  sellingPoints: [],
  materials: "",
  colors: "",
  targetAudience: [],
  usageScenes: [],
  estimatedDimensions: "",
};

const SALES_REGION_LANGUAGE_MAP: Record<ImageStudioSalesRegion, ImageStudioLanguage> = {
  us: "en",
  eu: "en",
  uk: "en",
  jp: "ja",
  kr: "ko",
  cn: "zh",
  sea: "en",
  me: "ar",
  latam: "es",
  br: "pt",
};

export function getDefaultImageLanguageForRegion(region: string): ImageStudioLanguage {
  return SALES_REGION_LANGUAGE_MAP[region as ImageStudioSalesRegion] || "en";
}

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

export function arrayToMultiline(values: string[] | undefined | null): string {
  return (Array.isArray(values) ? values : []).join("\n");
}

export function multilineToArray(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeImageStudioAnalysis(input?: Partial<ImageStudioAnalysis> | null): ImageStudioAnalysis {
  return {
    productName: typeof input?.productName === "string" ? input.productName : "",
    category: typeof input?.category === "string" ? input.category : "",
    sellingPoints: Array.isArray(input?.sellingPoints) ? input.sellingPoints.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    materials: typeof input?.materials === "string" ? input.materials : "",
    colors: typeof input?.colors === "string" ? input.colors : "",
    targetAudience: Array.isArray(input?.targetAudience) ? input.targetAudience.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    usageScenes: Array.isArray(input?.usageScenes) ? input.usageScenes.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    estimatedDimensions: typeof input?.estimatedDimensions === "string" ? input.estimatedDimensions : "",
  };
}

export function hasMaskedValue(value: string | undefined | null): boolean {
  return typeof value === "string" && value.includes("...");
}

export function isConfigMissing(config: ImageStudioConfig): boolean {
  return !config.analyzeApiKey || !config.generateApiKey;
}
