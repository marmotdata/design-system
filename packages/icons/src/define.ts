import { MmIcon } from './icon.js';
import { MmProviderLogo } from './provider-logo.js';
import './ui.js';
if (!customElements.get('mm-icon')) customElements.define('mm-icon', MmIcon);
if (!customElements.get('mm-provider-logo')) customElements.define('mm-provider-logo', MmProviderLogo);
