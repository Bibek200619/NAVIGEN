import '@testing-library/jest-dom/vitest';

/**
 * Ensure React is available globally for JSX in test files.
 * The production components import React themselves, but the test files
 * use JSX syntax (e.g. <Component />) which needs React in scope
 * when the automatic JSX runtime is not configured for the test environment.
 */
import React from 'react';
globalThis.React = React;
