
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppAction, SetupInfo, DiscoveredModule, TestCase, TestStatus, AppTab } from '../types';
import { DEFAULT_SETUP_INFO, LOCAL_STORAGE_KEY } from '../constants';

const initialState: AppState = {
  setupInfo: DEFAULT_SETUP_INFO,
  discoveredModules: [],
  testCases: [],
  cachedSuggestions: null,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  navigateTo: (tab: AppTab) => void;
}>({
  state: initialState,
  dispatch: () => null,
  navigateTo: () => null,
});

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_SETUP_INFO':
      return { ...state, setupInfo: action.payload };
    case 'ADD_DISCOVERED_MODULE':
      // Avoid duplicates by name
      if (state.discoveredModules.find(m => m.name === action.payload.name)) {
        return state;
      }
      return { ...state, discoveredModules: [...state.discoveredModules, action.payload] };
    case 'ADD_DISCOVERED_MODULES': {
        const newModules = action.payload.filter(
            (newModule) => !state.discoveredModules.some((existing) => existing.name === newModule.name)
        );
        if (newModules.length === 0) return state;
        return { ...state, discoveredModules: [...state.discoveredModules, ...newModules] };
    }
    case 'UPDATE_DISCOVERED_MODULE_INSIGHTS':
      return {
        ...state,
        discoveredModules: state.discoveredModules.map(m =>
          m.id === action.payload.id ? { ...m, insights: action.payload.insights } : m
        ),
      };
    case 'ADD_TEST_CASES':
      // Filter out duplicates by title and module if necessary, or assume new ones are unique
      // For simplicity, directly add. Consider more robust duplicate checking if needed.
      return { ...state, testCases: [...state.testCases, ...action.payload] };
    case 'UPDATE_TEST_CASE':
      return {
        ...state,
        testCases: state.testCases.map(tc =>
          tc.id === action.payload.id ? action.payload : tc
        ),
      };
    case 'DELETE_TEST_CASE':
      return {
        ...state,
        testCases: state.testCases.filter(tc => tc.id !== action.payload),
      };
    case 'SET_TEST_CASES':
      return { ...state, testCases: action.payload };
    case 'CACHE_SUGGESTIONS':
        return { ...state, cachedSuggestions: action.payload };
    case 'RESET_STATE':
        // The reducer should be a pure function. It should only return the new state.
        // The side-effect of interacting with localStorage is handled by the useEffect in AppProvider.
        // When this new initial state is returned, the useEffect will overwrite the old stored state.
        return initialState;
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: ReactNode; navigateTo: (tab: AppTab) => void }> = ({ children, navigateTo }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (initial) => {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        // Ensure test cases have a valid status
        if (parsedData.testCases) {
            parsedData.testCases = parsedData.testCases.map((tc: TestCase) => ({
                ...tc,
                status: tc.status || TestStatus.PENDING,
            }));
        }
        return { ...initial, ...parsedData };
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch, navigateTo }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
