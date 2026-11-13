import { SandboxProvider, SandboxProviderConfig } from './types';
import { BashyOciProvider } from './providers/bashy-oci-provider';

export class SandboxFactory {
  static create(provider?: string, config?: SandboxProviderConfig): SandboxProvider {
    // Use environment variable if provider not specified
    const selectedProvider = provider || process.env.SANDBOX_PROVIDER || 'bashy-oci';
    
    
    switch (selectedProvider.toLowerCase()) {
      case 'bashy-oci':
      case 'local':
        return new BashyOciProvider(config || {});

      default:
        throw new Error(`Unknown sandbox provider: ${selectedProvider}. Supported provider: bashy-oci`);
    }
  }
  
  static getAvailableProviders(): string[] {
    return ['bashy-oci'];
  }
  
  static isProviderAvailable(provider: string): boolean {
    switch (provider.toLowerCase()) {
      case 'bashy-oci':
      case 'local':
        return true;

      default:
        return false;
    }
  }
}
