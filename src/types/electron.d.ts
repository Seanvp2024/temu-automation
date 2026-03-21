interface AutomationAPI {
  launch: (accountId: string, headless?: boolean) => Promise<{ status: string }>;
  login: (accountId: string, email: string, password: string) => Promise<{ success: boolean }>;
  scrapeProducts: () => Promise<{ products: ScrapedProduct[] }>;
  scrapeOrders: () => Promise<{ orders: ScrapedOrder[] }>;
  scrapeSales: () => Promise<{ sales: { summary: Record<string, string>; items: any[]; pageText: string } }>;
  close: () => Promise<{ status: string }>;
  ping: () => Promise<{ status: string }>;
}

interface ScrapedProduct {
  temuProductId?: string;
  title: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
  category?: string;
  imageUrl?: string;
}

interface ScrapedOrder {
  orderId: string;
  productTitle: string;
  quantity: number;
  amount: number;
  status: string;
  orderTime: string;
}

interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, data: any) => Promise<boolean>;
}

interface ElectronAPI {
  getAppPath: () => Promise<string>;
  automation: AutomationAPI;
  store: StoreAPI;
  onAutomationEvent: (callback: (data: any) => void) => void;
  onAutomationLog: (callback: (data: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
