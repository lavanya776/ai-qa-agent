import { AppTab } from './types';

// Using Gemini 2.5 Flash model for text generation tasks.
export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash';
// export const GEMINI_MODEL_IMAGE = 'imagen-3.0-generate-002'; // If image generation was needed

export const APP_TABS = [
  { id: AppTab.DASHBOARD, name: "Dashboard", shortName: "Dash" },
  { id: AppTab.SETUP, name: "Setup", shortName: "Setup" },
  { id: AppTab.AI_DISCOVERY, name: "AI Discovery", shortName: "Discover" },
  { id: AppTab.TEST_GENERATION, name: "Test Generation", shortName: "Generate" },
  { id: AppTab.TEST_SUITE, name: "Test Suite", shortName: "Suite" },
  { id: AppTab.TEST_EXECUTION, name: "Test Execution", shortName: "Execute" },
];

export const DEFAULT_SETUP_INFO = {
  appUrl: "",
  appDescription: "",
  loginDetails: "",
  googleSheetLink: "",
};

export const TEST_CASE_GENERATION_COUNT_TARGET = 30; // Min tests to ask Gemini for. Max is 50.
export const MAX_TEST_CASES_TO_REQUEST = 50;

export const LOCAL_STORAGE_KEY = 'aiQaAgentData';

// Re-export AppTab so it can be imported from constants.ts as App.tsx expects
export { AppTab };