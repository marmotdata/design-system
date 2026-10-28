/** Registers every provider mark synchronously (SSR, or apps that show many providers at once). */
import { providerMarks } from './generated/providers-all.js';
import { registerProviders } from './registry.js';
registerProviders(providerMarks);
export { providerMarks };
