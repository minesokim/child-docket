// Welcome — first page after the (mock) sign-in.
// DEMO BUILD — no server-side getOrCreateCurrentClient(). Just renders the
// welcome content directly. Visitors don't need an authed session in demo.

import { WelcomeContent } from './content';

export default function WelcomePage() {
  return <WelcomeContent />;
}
