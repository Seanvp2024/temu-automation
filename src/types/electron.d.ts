interface AutomationAPI {
  login: (accountId: string, phone: string, password: string) => Promise<{ success: boolean; matchedStoreName?: string }>;
  scrapeProducts: () => Promise<any>;
  scrapeOrders: () => Promise<any>;
  scrapeSales: () => Promise<any>;
  scrapeFlux: () => Promise<any>;
  scrapeDashboard: () => Promise<any>;
  scrapeAfterSales: () => Promise<any>;
  scrapeSoldOut: () => Promise<any>;
  scrapeGoodsData: () => Promise<any>;
  scrapeActivity: () => Promise<any>;
  scrapePerformance: () => Promise<any>;
  scrapeAll: () => Promise<any>;
  readScrapeData: (key: string) => Promise<any>;
  scrapeLifecycle: () => Promise<any>;
  scrapeBidding: () => Promise<any>;
  scrapePriceCompete: () => Promise<any>;
  scrapeHotPlan: () => Promise<any>;
  scrapeCheckup: () => Promise<any>;
  scrapeUSRetrieval: () => Promise<any>;
  scrapeDelivery: () => Promise<any>;
  createProduct: (params: any) => Promise<any>;
  autoPricing: (params: any) => Promise<any>;
  startAutoPricing: (params: any) => Promise<any>;
  getProgress: () => Promise<any>;
  getTaskProgress: (taskId?: string) => Promise<any>;
  listTasks: () => Promise<any>;
  pausePricing: (taskId?: string) => Promise<any>;
  resumePricing: (taskId?: string) => Promise<any>;
  listDrafts: () => Promise<any>;
  retryDraft: (draftId: string) => Promise<any>;
  deleteDraft: (draftId: string) => Promise<any>;
  fetchProductDetailData: (params: any) => Promise<any>;
  close: () => Promise<{ status: string }>;
  ping: () => Promise<{ status: string }>;
}

interface ImageStudioStatus {
  status: string;
  message: string;
  url: string;
  projectPath: string;
  port: number;
  ready: boolean;
}

interface ImageStudioAPI {
  getStatus: () => Promise<ImageStudioStatus>;
  ensureRunning: () => Promise<ImageStudioStatus>;
  restart: () => Promise<ImageStudioStatus>;
  openExternal: () => Promise<string>;
}

interface AppAPI {
  getVersion: () => Promise<string>;
  openLogDirectory: () => Promise<string>;
}

interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, data: any) => Promise<boolean>;
}

interface ElectronAPI {
  getAppPath: () => Promise<string>;
  selectFile: (filters?: any) => Promise<string | null>;
  automation: AutomationAPI;
  imageStudio: ImageStudioAPI;
  app: AppAPI;
  store: StoreAPI;
  onAutomationEvent: (callback: (data: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
