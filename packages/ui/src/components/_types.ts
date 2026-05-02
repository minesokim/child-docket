// Shared internal types for components/. Not exported from the package
// barrel — public consumers see React.CSSProperties directly.

import type * as React from 'react';

/** CSS style override prop, optional, used by every primitive. */
export type StyleProp = React.CSSProperties | undefined;
