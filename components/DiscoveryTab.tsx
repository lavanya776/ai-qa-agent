
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { DiscoveredModule, SuggestedModule } from '../types';
import { discoverModulesWithAI, analyzeModuleWithGemini } from '../services/geminiService';
import LoadingSpinner from './shared/LoadingSpinner';
import Alert from './shared/Alert';
import toast from 'react-hot-toast';
import { BrainCircuit, PlusCircle, CheckSquare, Square, PencilLine, RotateCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const DiscoveryTab: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedModules, setSuggestedModules] = useState<SuggestedModule[]>([]);
  const [checkedModules, setCheckedModules] = useState<Record<string, boolean>>({});
  
  const [manualModuleName, setManualModuleName] = useState('');
  const [manualModuleDesc, setManualModuleDesc] = useState('');
  
  const [analyzingModuleId, setAnalyzingModuleId] = useState<string | null>(null);

  const isSetupForDiscovery = !!state.setupInfo.appUrl || !!state.setupInfo.appDescription;

  const runActualDiscovery = async (discoveryKey: string, force = false) => {
    setIsLoading(true);
    setError(null);
    setSuggestedModules([]);
    try {
      const { modules } = await discoverModulesWithAI(state.setupInfo.appUrl, state.setupInfo.appDescription, force);
      
      dispatch({ type: 'CACHE_SUGGESTIONS', payload: { forInputs: discoveryKey, modules } });

      setSuggestedModules(modules);
      const newChecked = Object.fromEntries(modules.map(mod => [mod.name, true]));
      setCheckedModules(newChecked);

      if (force) {
        toast.success(`AI re-discovered ${modules.length} modules.`);
      } else {
        toast.success(`${modules.length} new modules discovered by AI.`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(`Discovery failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscoverModules = async () => {
    if (!isSetupForDiscovery) {
      toast.error("Please provide an Application URL and/or Description in the Setup tab first.");
      return;
    }
    const discoveryKey = JSON.stringify({ url: state.setupInfo.appUrl, desc: state.setupInfo.appDescription });

    if (state.cachedSuggestions && state.cachedSuggestions.forInputs === discoveryKey) {
      toast.success("Loaded consistent results from cache.");
      setSuggestedModules(state.cachedSuggestions.modules);
      const newChecked = Object.fromEntries(state.cachedSuggestions.modules.map(mod => [mod.name, true]));
      setCheckedModules(newChecked);
      return;
    }

    await runActualDiscovery(discoveryKey, false);
  };
  
  const handleForceDiscover = async () => {
      if (!isSetupForDiscovery) {
        toast.error("Please provide an Application URL and/or Description in the Setup tab first.");
        return;
      }
      if (window.confirm("Forcing a re-discovery will call the AI again and may produce a different set of suggestions. The new set will become your cached result. Continue?")) {
        const discoveryKey = JSON.stringify({ url: state.setupInfo.appUrl, desc: state.setupInfo.appDescription });
        await runActualDiscovery(discoveryKey, true);
      }
  };


  const handleCheckboxChange = (moduleName: string) => {
    setCheckedModules(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const handleAddSelectedModules = () => {
    const modulesToAdd: DiscoveredModule[] = suggestedModules
      .filter(mod => checkedModules[mod.name])
      .map(mod => ({
        id: crypto.randomUUID(),
        name: mod.name,
        description: mod.description,
        insights: ''
      }));
      
    if (modulesToAdd.length > 0) {
      dispatch({ type: 'ADD_DISCOVERED_MODULES', payload: modulesToAdd });
      toast.success(`${modulesToAdd.length} selected modules added to the project.`);
      setSuggestedModules([]);
      setCheckedModules({});
    } else {
      toast.error("No modules selected to add.");
    }
  };

  const handleManualAddModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualModuleName.trim() || !manualModuleDesc.trim()) {
        toast.error("Please provide both a name and a description for the module.");
        return;
    }
    const newModule: DiscoveredModule = {
        id: crypto.randomUUID(),
        name: manualModuleName.trim(),
        description: manualModuleDesc.trim(),
        insights: ''
    };
    dispatch({ type: 'ADD_DISCOVERED_MODULE', payload: newModule });
    toast.success(`Module "${newModule.name}" added manually.`);
    setManualModuleName('');
    setManualModuleDesc('');
  };

  const handleAnalyzeModule = async (moduleId: string, moduleName: string, moduleDescription: string) => {
    if (analyzingModuleId) return; // Prevent multiple analyses at once
    setAnalyzingModuleId(moduleId);
    setError(null);
    try {
        const insights = await analyzeModuleWithGemini(moduleName, moduleDescription);
        dispatch({ type: 'UPDATE_DISCOVERED_MODULE_INSIGHTS', payload: { id: moduleId, insights } });
        toast.success(`Analysis complete for "${moduleName}".`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
        setError(errorMessage);
        toast.error(`Analysis failed: ${errorMessage}`);
    } finally {
        setAnalyzingModuleId(null);
    }
  };


  return (
    <div className="space-y-8">
      {/* AI Suggestion Engine */}
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-3 flex items-center">
          <BrainCircuit size={24} className="mr-3 text-sky-300" />
          AI Module Discovery
        </h2>
        <div className={`p-4 bg-gray-700/50 rounded-lg border border-gray-600 ${!isSetupForDiscovery && 'opacity-60'}`}>
            <p className="text-gray-300 mb-4 text-center">
                Use AI to discover key application modules. The result is cached for consistency. Use the refresh button to get new suggestions from the AI.
            </p>
            <div className="flex justify-center gap-4">
                <button
                    onClick={handleDiscoverModules}
                    disabled={isLoading || !isSetupForDiscovery}
                    title={!isSetupForDiscovery ? 'Please provide an App URL and/or Description in the Setup tab' : 'Discover modules (uses cache if available)'}
                    className="flex-grow flex items-center justify-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <LoadingSpinner size={20} /> : <><BrainCircuit size={20} className="mr-2"/> Discover Modules</>}
                </button>
                <button
                    onClick={handleForceDiscover}
                    disabled={isLoading || !isSetupForDiscovery}
                    title="Force AI to re-discover modules, ignoring the cache"
                    className="p-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RotateCw size={20} />
                </button>
            </div>
        </div>
      </div>

       {/* Manual Module Entry */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-3 flex items-center">
                <PencilLine size={24} className="mr-3 text-sky-300" />
                Add Module Manually
            </h2>
            <p className="text-gray-300 mb-4">
                Add modules that the AI might have missed, such as pages that require login or have complex workflows.
            </p>
            <form onSubmit={handleManualAddModule} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-1">
                    <label htmlFor="manualModuleName" className="block text-sm font-medium text-gray-300 mb-1">Module Name</label>
                    <input
                        type="text"
                        id="manualModuleName"
                        value={manualModuleName}
                        onChange={(e) => setManualModuleName(e.target.value)}
                        placeholder="e.g., User Profile Settings"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
                        required
                    />
                </div>
                 <div className="md:col-span-2">
                    <label htmlFor="manualModuleDesc" className="block text-sm font-medium text-gray-300 mb-1">Module Description</label>
                    <input
                        type="text"
                        id="manualModuleDesc"
                        value={manualModuleDesc}
                        onChange={(e) => setManualModuleDesc(e.target.value)}
                        placeholder="e.g., Allows users to update their personal information and preferences."
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
                        required
                    />
                </div>
                <div className="md:col-span-3 flex justify-end">
                    <button type="submit" className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors">
                        <PlusCircle size={18} className="mr-2"/>
                        Add Manual Module
                    </button>
                </div>
            </form>
        </div>


      {error && <Alert type="error" title="Discovery Error">{error}</Alert>}
      
      {/* AI Suggestions List */}
      {suggestedModules.length > 0 && (
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-green-400">AI-Suggested Modules</h3>
          <ul className="space-y-3 mb-4">
            {suggestedModules.map((mod) => (
              <li key={mod.name} className="flex items-center p-3 bg-gray-700 rounded-md">
                <button onClick={() => handleCheckboxChange(mod.name)} className="mr-4 flex-shrink-0 text-sky-400">
                  {checkedModules[mod.name] ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div>
                  <p className="font-semibold text-gray-200">{mod.name}</p>
                  <p className="text-sm text-gray-400">{mod.description}</p>
                </div>
              </li>
            ))}
          </ul>
          
          <button
            onClick={handleAddSelectedModules}
            className="mt-4 flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow"
          >
            <PlusCircle size={18} className="mr-2" />
            Add Selected to Project
          </button>
        </div>
      )}

      {/* Existing Modules List */}
      {state.discoveredModules.length > 0 && (
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-green-400">Project Modules ({state.discoveredModules.length})</h3>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {state.discoveredModules.slice().reverse().map((mod) => (
              <div key={mod.id} className="p-4 bg-gray-700/60 rounded-lg border border-gray-600/50">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-bold text-lg text-gray-200">{mod.name}</h4>
                    <p className="text-sm text-gray-400">{mod.description}</p>
                  </div>
                  {!mod.insights && (
                    <button
                      onClick={() => handleAnalyzeModule(mod.id, mod.name, mod.description)}
                      disabled={analyzingModuleId === mod.id}
                      className="flex-shrink-0 flex items-center text-sm px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                      {analyzingModuleId === mod.id ? (
                        <LoadingSpinner size={16} />
                      ) : (
                        <>
                          <BrainCircuit size={16} className="mr-1.5" />
                          Analyze
                        </>
                      )}
                    </button>
                  )}
                </div>
                {analyzingModuleId === mod.id && !mod.insights && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                        <LoadingSpinner text="AI is analyzing this module for QA insights..."/>
                    </div>
                )}
                {mod.insights && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <h5 className="text-sm font-semibold text-gray-300 mb-2 flex items-center"><BrainCircuit size={14} className="mr-2 text-sky-400"/> QA Insights:</h5>
                    <div className="prose prose-sm prose-invert max-w-none text-gray-300 bg-gray-900/30 p-3 rounded-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{mod.insights}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
