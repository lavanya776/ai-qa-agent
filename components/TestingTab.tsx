import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { TestCase, TestType, ALL_TEST_TYPES, TestStatus, GeneratedTestCaseData } from '../types';
import { generateTestCasesWithGemini, generateNextIdForModule } from '../services/geminiService';
import LoadingSpinner from './shared/LoadingSpinner';
import Alert from './shared/Alert';
import toast from 'react-hot-toast';
import { Bot, RefreshCw, CheckSquare, Square, Library, CheckCheck, XSquare } from 'lucide-react';
import { MAX_TEST_CASES_TO_REQUEST } from '../constants';

const TestGenerationTab: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for generation
  const [modulesForGeneration, setModulesForGeneration] = useState<Record<string, boolean>>({});
  const [selectedTestTypes, setSelectedTestTypes] = useState<Record<string, boolean>>(() => {
    const initialTypes: Record<string, boolean> = {};
    [TestType.FUNCTIONAL, TestType.UI_UX, TestType.NEGATIVE].forEach(t => initialTypes[t] = true);
    return initialTypes;
  });
  const [testsPerModule, setTestsPerModule] = useState<number>(10);

  const availableModules = useMemo(() => {
    const fromDiscovered = state.discoveredModules.map(m => m.name);
    const fromTestCases = state.testCases.map(tc => tc.module);
    return Array.from(new Set([...fromDiscovered, ...fromTestCases])).filter(Boolean).sort();
  }, [state.discoveredModules, state.testCases]);

  // Use useEffect to sync the selection state when the list of available modules changes.
  useEffect(() => {
    setModulesForGeneration(prev => {
        const newSelection: Record<string, boolean> = {};
        // Keep existing selections if they are still available, otherwise default to false
        availableModules.forEach(mod => {
            newSelection[mod] = prev[mod] || false;
        });
        return newSelection;
    });
  }, [availableModules]);


    const runGeneration = async (modules: string[], types: TestType[], testsToGenerate: number) => {
        if (modules.length === 0) {
            toast.error("No modules selected for generation.");
            return;
        }
        if (types.length === 0) {
            toast.error("Please select at least one test methodology.");
            return;
        }
        if (testsToGenerate <= 0) {
            toast.error("Number of tests to generate must be positive.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const allNewTestCases: TestCase[] = [];
        let allTestCasesContext = [...state.testCases];

        for (let i = 0; i < modules.length; i++) {
            const moduleName = modules[i];
            const moduleInfo = state.discoveredModules.find(m => m.name === moduleName);
            const moduleDescription = moduleInfo?.description || state.setupInfo.appDescription;
            const existingTestsForModule = allTestCasesContext.filter(tc => tc.module === moduleName);

            toast(`Generating tests for module: ${moduleName}... (${i + 1}/${modules.length})`, { icon: '🤖' });

            try {
                const generatedData: GeneratedTestCaseData[] = await generateTestCasesWithGemini(
                    moduleName,
                    moduleDescription,
                    existingTestsForModule.length,
                    testsToGenerate,
                    types
                );

                generatedData.forEach(data => {
                    const newId = generateNextIdForModule(moduleName, allTestCasesContext);
                    const newTestCase: TestCase = {
                        id: newId,
                        title: data.title,
                        description: data.description,
                        steps: data.steps,
                        expectedResults: data.expectedResults,
                        type: data.type as TestType,
                        module: moduleName,
                        status: TestStatus.PENDING,
                    };
                    allNewTestCases.push(newTestCase);
                    allTestCasesContext.push(newTestCase);
                });
                
            } catch (err) {
                console.error(err);
                const errorMessage = err instanceof Error ? err.message : `An unknown error occurred for module ${moduleName}.`;
                setError(prev => (prev ? `${prev}\n${errorMessage}` : errorMessage));
                toast.error(`Failed on "${moduleName}": ${errorMessage.substring(0, 50)}...`);
                 // Stop the whole process on the first error to avoid cascading failures
                setIsLoading(false);
                return;
            }
        }

        if (allNewTestCases.length > 0) {
            dispatch({ type: 'ADD_TEST_CASES', payload: allNewTestCases });
            toast.success(`Batch generation complete! Added ${allNewTestCases.length} new test cases.`);
        } else {
            toast.error("Batch generation finished, but no new test cases were created.");
        }

        setIsLoading(false);
    };


    const handleGenerateTests = async () => {
        const selectedModules = Object.entries(modulesForGeneration).filter(([, isSelected]) => isSelected).map(([name]) => name);
        const chosenTestTypes = Object.entries(selectedTestTypes).filter(([, isSelected]) => isSelected).map(([type]) => type as TestType);

        if (selectedModules.length === 0) {
            toast.error("Please select at least one module to generate tests for.");
            return;
        }
        
        if (testsPerModule <= 0 || testsPerModule > MAX_TEST_CASES_TO_REQUEST) {
            toast.error(`Number of tests per module must be between 1 and ${MAX_TEST_CASES_TO_REQUEST}.`);
            return;
        }

        await runGeneration(selectedModules, chosenTestTypes, testsPerModule);
    };

    const handleGenerateComprehensiveSuite = async () => {
        /*
        const allModules = availableModules;
        if (allModules.length === 0) {
            toast.error("No modules available to generate tests. Please discover modules first.");
            return;
        }
        const allTypes = ALL_TEST_TYPES;
        const comprehensiveTestsPerModule = MAX_TEST_CASES_TO_REQUEST;

        if (window.confirm(`This will generate a comprehensive test suite for all ${allModules.length} modules, requesting up to ${comprehensiveTestsPerModule} test cases for each. This may take a long time and consume significant API quota. Are you sure?`)) {
            // Visually update the selections for the user
            handleModuleSelection(true);
            handleTestTypeSelection(true);
            setTestsPerModule(comprehensiveTestsPerModule);
            
            await runGeneration(allModules, allTypes, comprehensiveTestsPerModule);
        }
        */
    };
    
    const handleModuleSelection = (selectAll: boolean) => {
        const newSelection = Object.fromEntries(availableModules.map(mod => [mod, selectAll]));
        setModulesForGeneration(newSelection);
    };

    const handleTestTypeSelection = (selectAll: boolean) => {
        const newSelection = Object.fromEntries(ALL_TEST_TYPES.map(type => [type, selectAll]));
        setSelectedTestTypes(newSelection);
    };


  const handleModuleForGenerationToggle = (moduleName: string) => {
    setModulesForGeneration(prev => ({...prev, [moduleName]: !prev[moduleName]}));
  };

  const handleTestTypeToggle = (testType: string) => {
    setSelectedTestTypes(prev => ({...prev, [testType]: !prev[testType]}));
  };


  return (
    <div className="space-y-6">
      {/* Test Case Generation Section */}
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-2 flex items-center">
          <Bot size={22} className="mr-2 text-sky-300"/> AI Test Case Generation
        </h2>
        
        {/* Step 1: Select Modules */}
        <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-300">Step 1: Select Modules</h3>
                <div className="flex gap-3">
                    <button onClick={() => handleModuleSelection(true)} className="text-xs flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"><CheckCheck size={14}/> Select All</button>
                    <button onClick={() => handleModuleSelection(false)} className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300 font-medium"><XSquare size={14}/> Clear</button>
                </div>
            </div>
            {availableModules.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-900/50 rounded">
                    {availableModules.map(moduleName => (
                        <button key={moduleName} onClick={() => handleModuleForGenerationToggle(moduleName)}
                                className={`flex items-center p-2 text-sm rounded-md transition-colors ${modulesForGeneration[moduleName] ? 'bg-sky-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            {modulesForGeneration[moduleName] ? <CheckSquare size={16} className="mr-2 flex-shrink-0" /> : <Square size={16} className="mr-2 flex-shrink-0" />}
                            <span className="truncate" title={moduleName}>{moduleName}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <Alert type="info">No modules found. Discover modules in the "AI Discovery" tab or add a test case manually in the "Test Suite" tab to create one.</Alert>
            )}
        </div>

        {/* Step 2: Select Methodologies */}
        <div className="mb-4">
             <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-300">Step 2: Select Test Methodologies</h3>
                <div className="flex gap-3">
                    <button onClick={() => handleTestTypeSelection(true)} className="text-xs flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"><CheckCheck size={14}/> Select All</button>
                    <button onClick={() => handleTestTypeSelection(false)} className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300 font-medium"><XSquare size={14}/> Clear</button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ALL_TEST_TYPES.map(type => (
                    <button key={type} onClick={() => handleTestTypeToggle(type)}
                            className={`flex items-center p-2 text-sm rounded-md transition-colors ${selectedTestTypes[type] ? 'bg-sky-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        {selectedTestTypes[type] ? <CheckSquare size={16} className="mr-2 flex-shrink-0" /> : <Square size={16} className="mr-2 flex-shrink-0" />}
                        <span className="truncate" title={type}>{type}</span>
                    </button>
                ))}
            </div>
        </div>

         {/* Step 3: Specify Quantity & Generate */}
         <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Step 3: Set Quantity & Generate</h3>
            <label htmlFor="testsPerModule" className="block text-sm font-medium text-gray-400 mb-1">Tests to Generate per Module</label>
            <input 
                type="number"
                id="testsPerModule"
                value={testsPerModule}
                onChange={(e) => setTestsPerModule(parseInt(e.target.value, 10) || 0)}
                min="1"
                max={MAX_TEST_CASES_TO_REQUEST}
                className="w-full md:w-1/3 p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <div className="flex flex-wrap gap-4 items-center mt-4 pt-4 border-t border-gray-700">
            <button
            onClick={handleGenerateTests}
            disabled={isLoading || Object.values(modulesForGeneration).every(v => !v)}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-md transition-colors disabled:opacity-50"
            >
            {isLoading ? <LoadingSpinner size={18} /> : <><RefreshCw size={18} className="mr-2"/> Generate Custom Selection</>}
            </button>
            {/*
             <button
                onClick={handleGenerateComprehensiveSuite}
                disabled={isLoading || availableModules.length === 0}
                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-md transition-colors disabled:opacity-50"
            >
                {isLoading ? <LoadingSpinner size={18} /> : <><Library size={18} className="mr-2"/> Generate Comprehensive Suite</>}
            </button>
            */}
        </div>
        {error && <Alert type="error" title="Generation Error" className="mt-4">{error}</Alert>}
      </div>
    </div>
  );
};

export default TestGenerationTab;