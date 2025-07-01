
import React, { useState } from 'react';
import { Settings, BrainCircuit, BarChart2, LayoutDashboard, ClipboardPlus, ClipboardCheck, ListChecks } from 'lucide-react';
import SetupTab from './components/SetupTab';
import { DiscoveryTab } from './components/DiscoveryTab';
import TestGenerationTab from './components/TestingTab';
import TestSuiteTab from './components/TestSuiteTab';
import ResultsTab from './components/ResultsTab';
import DashboardTab from './components/DashboardTab';
import { AppTab, APP_TABS } from './constants';
import { AppProvider } from './context/AppContext';
import { Toaster } from 'react-hot-toast';


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);

  const renderTabContent = () => {
    switch (activeTab) {
      case AppTab.DASHBOARD:
        return <DashboardTab />;
      case AppTab.SETUP:
        return <SetupTab />;
      case AppTab.AI_DISCOVERY:
        return <DiscoveryTab />;
      case AppTab.TEST_GENERATION:
        return <TestGenerationTab />;
      case AppTab.TEST_SUITE:
        return <TestSuiteTab />;
      case AppTab.TEST_EXECUTION:
        return <ResultsTab />;
      default:
        return null;
    }
  };

  const TabIcon: React.FC<{ tab: AppTab }> = ({ tab }) => {
    const size = 20;
    switch (tab) {
      case AppTab.DASHBOARD:
        return <LayoutDashboard size={size} />;
      case AppTab.SETUP:
        return <Settings size={size} />;
      case AppTab.AI_DISCOVERY:
        return <BrainCircuit size={size} />;
      case AppTab.TEST_GENERATION:
        return <ClipboardPlus size={size} />;
      case AppTab.TEST_SUITE:
        return <ClipboardCheck size={size} />;
      case AppTab.TEST_EXECUTION:
        return <BarChart2 size={size} />;
      default:
        return null;
    }
  };

  return (
    <AppProvider navigateTo={setActiveTab}>
      <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
        <header className="bg-gray-800 shadow-md p-4">
          <h1 className="text-3xl font-bold text-center text-sky-400 flex items-center justify-center">
            <ListChecks size={36} className="mr-3 text-sky-500" />
            AI QA Agent
          </h1>
        </header>

        <nav className="bg-gray-800 border-b border-gray-700">
          <ul className="flex justify-center space-x-2 sm:space-x-4 p-2">
            {APP_TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-3 text-sm sm:text-base font-medium rounded-t-lg transition-colors duration-150 ease-in-out
                              ${activeTab === tab.id 
                                ? 'bg-sky-600 text-white shadow-inner' 
                                : 'text-gray-400 hover:text-sky-400 hover:bg-gray-700'}`}
                >
                  <TabIcon tab={tab.id} />
                  <span className="ml-2 hidden sm:inline">{tab.name}</span>
                  <span className="ml-2 sm:hidden">{tab.shortName}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          {renderTabContent()}
        </main>
        
        <Toaster 
            position="top-right"
            toastOptions={{
              className: '',
              style: {
                background: '#2d3748', // bg-gray-700
                color: '#e2e8f0', // text-gray-200
                border: '1px solid #4a5568' // border-gray-600
              },
              error: {
                iconTheme: {
                  primary: '#f56565', // red-500
                  secondary: '#1a202c', // gray-900
                },
              },
              success: {
                iconTheme: {
                  primary: '#48bb78', // green-500
                  secondary: '#1a202c', // gray-900
                },
              }
            }}
          />

        <footer className="bg-gray-800 text-center p-4 text-sm text-gray-500 border-t border-gray-700">
          AI QA Agent &copy; 2025. Powered by LAVANYA.
        </footer>
      </div>
    </AppProvider>
  );
};

export default App;