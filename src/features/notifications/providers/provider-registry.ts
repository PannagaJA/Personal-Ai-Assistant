import type { INotificationProvider, NotificationItem } from "../types.js";
import { BrowserNotificationProvider } from "./browser-provider.js";
import { FcmNotificationProvider } from "./fcm-provider.js";

export class NotificationProviderRegistry {
  private static instance: NotificationProviderRegistry;
  private providers: Map<string, INotificationProvider> = new Map();

  private constructor() {
    this.register(new BrowserNotificationProvider());
    this.register(new FcmNotificationProvider());
  }

  public static getInstance(): NotificationProviderRegistry {
    if (!NotificationProviderRegistry.instance) {
      NotificationProviderRegistry.instance = new NotificationProviderRegistry();
    }
    return NotificationProviderRegistry.instance;
  }

  public register(provider: INotificationProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): INotificationProvider | undefined {
    return this.providers.get(id);
  }

  public async dispatchAll(notification: NotificationItem): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        await provider.send(notification).catch(() => null);
      }
    }
  }
}
