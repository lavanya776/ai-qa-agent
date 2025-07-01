import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { TestCase, TestStatus, TestType, ALL_TEST_TYPES } from '../types';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, XCircle, AlertTriangle, PlayCircle, SkipForward, Edit3, Filter, RotateCcw, Download, FileText, Bug, Bot } from 'lucide-react';
import Modal from './shared/Modal';
import { convertTestCasesToCSV, convertBugsToCSV, executeTestCaseWithGemini } from '../services/geminiService';
import LoadingSpinner from './shared/LoadingSpinner';


const StatusColors: Record<TestStatus, string> = {
  [TestStatus.PENDING]: '#718096', // gray-500
  [TestStatus.PASSED]: '#48BB78', // green-500
  [TestStatus.FAILED]: '#F56565', // red-500
  [TestStatus.BLOCKED]: '#ECC94B', // yellow-500
};

const ResultsTab: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [currentTestIndex, setCurrentTestIndex] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [testToEdit, setTestToEdit] = useState<TestCase | null>(null);
  const [actualResultsInput, setActualResultsInput] = useState('');

  const [filterModule, setFilterModule] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  
  const availableModules = useMemo(() => {
    return Array.from(new Set(state.testCases.map(tc => tc.module)));
  }, [state.testCases]);

  const testCasesToExecute = useMemo(() => {
    return state.testCases.filter(tc => 
        (filterModule ? tc.module === filterModule : true) &&
        (filterType ? tc.type === filterType : true) &&
        (filterStatus ? tc.status === filterStatus : true) &&
        (currentTestIndex === null ? true : true) // Ensure it doesn't filter out the current test if filters change
    ).sort((a,b) => { // Keep PENDING tests first
        if (a.status === TestStatus.PENDING && b.status !== TestStatus.PENDING) return -1;
        if (a.status !== TestStatus.PENDING && b.status === TestStatus.PENDING) return 1;
        return a.id.localeCompare(b.id);
    });
  }, [state.testCases, filterModule, filterType, filterStatus, currentTestIndex]);

  const currentTestCase = useMemo(() => {
    return currentTestIndex !== null && currentTestIndex < testCasesToExecute.length ? testCasesToExecute[currentTestIndex] : null;
  }, [currentTestIndex, testCasesToExecute]);

  const startExecution = useCallback(() => {
    if (testCasesToExecute.length > 0) {
      const firstPendingIndex = testCasesToExecute.findIndex(tc => tc.status === TestStatus.PENDING);
      setCurrentTestIndex(firstPendingIndex !== -1 ? firstPendingIndex : 0);
    } else {
      toast.error("No test cases available to execute with current filters.");
    }
  }, [testCasesToExecute]);
  
  const handleAutoExecution = async () => {
    const pendingTests = testCasesToExecute.filter(tc => tc.status === TestStatus.PENDING);
    if(pendingTests.length === 0) {
        toast.error("No pending test cases to execute with current filters.");
        return;
    }
    if(!state.setupInfo.appDescription) {
        toast.error("Please provide an application description in the Setup tab for the AI to have context.");
        return;
    }

    setIsAutoExecuting(true);
    
    const executionPromise = new Promise(async (resolve, reject) => {
        let failedCount = 0;
        for(let i = 0; i < pendingTests.length; i++) {
            const testCase = pendingTests[i];
            
            try {
                const result = await executeTestCaseWithGemini(testCase, state.setupInfo.appDescription);
                const updatedTestCase: TestCase = {
                    ...testCase,
                    status: result.status,
                    actualResults: result.actualResults
                };
                if(result.status === TestStatus.FAILED || result.status === TestStatus.BLOCKED) {
                    failedCount++;
                }
                dispatch({ type: 'UPDATE_TEST_CASE', payload: updatedTestCase });
            } catch (error) {
                // On the first error (e.g., rate limit), stop the entire process.
                return reject(error);
            }
        }
        resolve(failedCount);
    });

    toast.promise(executionPromise, {
        loading: `AI is executing ${pendingTests.length} tests...`,
        success: (failedCount) => {
            setIsAutoExecuting(false);
            return `Auto-execution complete! AI identified ${failedCount} potential bug(s).`;
        },
        error: (err) => {
             setIsAutoExecuting(false);
             const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
             return `Auto-execution failed: ${errorMessage}`;
        }
    });
  };


  const updateTestStatus = (status: TestStatus) => {
    if (currentTestCase) {
      const updatedTestCase: TestCase = { 
        ...currentTestCase, 
        status,
        actualResults: status === TestStatus.FAILED || status === TestStatus.BLOCKED ? actualResultsInput : (status === TestStatus.PASSED ? 'As expected.' : currentTestCase.actualResults)
      };
      dispatch({ type: 'UPDATE_TEST_CASE', payload: updatedTestCase });
      toast.success(`Test "${currentTestCase.title}" marked as ${status}.`);
      setActualResultsInput('');
      
      let nextIdx = -1;
      for (let i = (currentTestIndex || 0) + 1; i < testCasesToExecute.length; i++) {
          if (testCasesToExecute[i].status === TestStatus.PENDING) {
              nextIdx = i;
              break;
          }
      }
      if (nextIdx !== -1) {
          setCurrentTestIndex(nextIdx);
      } else if ((currentTestIndex || 0) + 1 < testCasesToExecute.length) {
          setCurrentTestIndex((currentTestIndex || 0) + 1);
      } else {
          setCurrentTestIndex(null);
          toast.success("All filtered tests processed!");
      }

    }
  };
  
   const handleExport = (type: 'all' | 'bugs') => {
    const testCasesToExport = (type === 'all')
        ? testCasesToExecute // Export currently filtered list
        : testCasesToExecute.filter(tc => tc.status === TestStatus.FAILED || tc.status === TestStatus.BLOCKED);

    if (testCasesToExport.length === 0) {
        toast.error(`No test cases to export for this report type.`);
        return;
    }

    const csvData = (type === 'all')
        ? convertTestCasesToCSV(testCasesToExport)
        : convertBugsToCSV(testCasesToExport);
        
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = (type === 'all') ? `test_results_${new Date().toISOString().split('T')[0]}.csv` : `bug_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${(type==='all' ? 'Results' : 'Bug')} report exported successfully.`);
  };


  const skipTest = () => {
    if (currentTestIndex !== null && (currentTestIndex + 1) < testCasesToExecute.length) {
      setCurrentTestIndex(currentTestIndex + 1);
    } else if (currentTestIndex !== null && (currentTestIndex + 1) >= testCasesToExecute.length) {
      setCurrentTestIndex(null);
      toast("Reached end of test list.");
    }
  };

  const openEditCurrentTestModal = () => {
    if (currentTestCase) {
      setTestToEdit(currentTestCase);
      setActualResultsInput(currentTestCase.actualResults || '');
      setIsEditModalOpen(true);
    }
  };

  const handleEditModalSave = () => {
    if (testToEdit) {
        const updatedStatus = testToEdit.status;
        const updatedTestCase: TestCase = { ...testToEdit, actualResults: actualResultsInput, status: updatedStatus };
        dispatch({ type: 'UPDATE_TEST_CASE', payload: updatedTestCase });
        toast.success(`Test "${testToEdit.title}" details updated.`);
        setIsEditModalOpen(false);
        setTestToEdit(null);
    }
  };
  
  const resetAllTestStatuses = () => {
    if (window.confirm("Are you sure you want to reset the status of ALL test cases to 'Pending'? This is useful for starting a new test cycle.")) {
        const resetTestCases = state.testCases.map(tc => ({ ...tc, status: TestStatus.PENDING, actualResults: undefined }));
        dispatch({ type: 'SET_TEST_CASES', payload: resetTestCases });
        setCurrentTestIndex(null);
        toast.success("All test case statuses have been reset to Pending.");
    }
  };

  const executionStats = useMemo(() => {
    const stats: Record<TestStatus, number> = {
      [TestStatus.PENDING]: 0,
      [TestStatus.PASSED]: 0,
      [TestStatus.FAILED]: 0,
      [TestStatus.BLOCKED]: 0,
    };
    state.testCases.forEach(tc => {
      stats[tc.status]++;
    });
    return Object.entries(stats).map(([name, value]) => ({ name: name as TestStatus, count: value }));
  }, [state.testCases]);

  const pendingTestsInFilter = useMemo(() => testCasesToExecute.filter(tc => tc.status === TestStatus.PENDING).length, [testCasesToExecute]);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-2">Test Execution Cycle</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
                <label htmlFor="filterModuleResults" className="block text-sm font-medium text-gray-300 mb-1">Filter by Module</label>
                <select id="filterModuleResults" value={filterModule} onChange={(e) => { setFilterModule(e.target.value); setCurrentTestIndex(null);}}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
                <option value="">All Modules</option>
                {availableModules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="filterTypeResults" className="block text-sm font-medium text-gray-300 mb-1">Filter by Type</label>
                <select id="filterTypeResults" value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentTestIndex(null); }}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
                <option value="">All Types</option>
                {ALL_TEST_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="filterStatusResults" className="block text-sm font-medium text-gray-300 mb-1">Filter by Status</label>
                <select id="filterStatusResults" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentTestIndex(null);}}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
                <option value="">All Statuses</option>
                {Object.values(TestStatus).map(status => <option key={status} value={status}>{status}</option>)}
                </select>
            </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={startExecution} disabled={testCasesToExecute.length === 0 || currentTestIndex !== null || isAutoExecuting}
                  className="flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow disabled:opacity-50 transition-colors">
            <PlayCircle size={18} className="mr-2"/> Start Manual Execution
          </button>
          <button onClick={handleAutoExecution} disabled={isAutoExecuting || pendingTestsInFilter === 0}
                  className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow disabled:opacity-50 transition-colors">
            <Bot size={18} className="mr-2"/> Run Auto-Execution with AI ({pendingTestsInFilter} Pending)
          </button>
           <button onClick={resetAllTestStatuses} disabled={isAutoExecuting}
                  className="flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-md shadow transition-colors disabled:opacity-50">
            <RotateCcw size={18} className="mr-2"/> Reset All Statuses
          </button>
        </div>
      </div>

      {currentTestCase && !isAutoExecuting && (
        <div className="p-6 bg-gray-700 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-yellow-300">Executing: {currentTestCase.title} ({currentTestIndex !== null ? currentTestIndex + 1 : '-'}/{testCasesToExecute.length})</h3>
            <button onClick={openEditCurrentTestModal} className="text-sm text-sky-400 hover:text-sky-300 flex items-center"><Edit3 size={16} className="mr-1"/> Edit Details</button>
          </div>
          <p className="text-xs text-gray-400 mb-1">Module: {currentTestCase.module} | Type: {currentTestCase.type}</p>
          <p className="text-sm text-gray-300 mb-3">{currentTestCase.description}</p>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-200 mb-1">Steps:</h4>
            <ul className="list-decimal list-inside pl-1 space-y-1 text-sm text-gray-300 bg-gray-600 p-3 rounded-md">
              {currentTestCase.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
          </div>
          <div className="mb-4">
            <h4 className="font-medium text-gray-200 mb-1">Expected Results:</h4>
            <p className="text-sm text-gray-300 bg-gray-600 p-3 rounded-md">{currentTestCase.expectedResults}</p>
          </div>
          <div className="mb-4">
            <label htmlFor="actualResultsInput" className="block text-sm font-medium text-gray-300 mb-1">Actual Results (if Failed/Blocked):</label>
            <textarea id="actualResultsInput" value={actualResultsInput} onChange={(e) => setActualResultsInput(e.target.value)}
                      rows={3} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500"/>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => updateTestStatus(TestStatus.PASSED)} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow transition-colors"><CheckCircle size={18} className="mr-2"/> Mark Passed</button>
            <button onClick={() => updateTestStatus(TestStatus.FAILED)} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow transition-colors"><XCircle size={18} className="mr-2"/> Mark Failed</button>
            <button onClick={() => updateTestStatus(TestStatus.BLOCKED)} className="flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-md shadow transition-colors"><AlertTriangle size={18} className="mr-2"/> Mark Blocked</button>
            <button onClick={skipTest} className="flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-400 text-white font-semibold rounded-md shadow transition-colors"><SkipForward size={18} className="mr-2"/> Skip</button>
          </div>
        </div>
      )}
      {!currentTestCase && currentTestIndex === null && testCasesToExecute.length > 0 && !isAutoExecuting && (
         <div className="p-6 bg-gray-700 rounded-lg shadow-lg text-center">
            <p className="text-gray-300">Execution cycle not started or completed for current filters.</p>
            <p className="text-sm text-gray-400">Click "Start Manual Execution" or "Run Auto-Execution" above to begin.</p>
        </div>
      )}
       {!currentTestCase && testCasesToExecute.length === 0 && !isAutoExecuting && (
         <div className="p-6 bg-gray-700 rounded-lg shadow-lg text-center">
            <p className="text-gray-300">No test cases match the current filter criteria.</p>
            <p className="text-sm text-gray-400">Adjust filters or add/generate more test cases.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Summary Report */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-2">Execution Summary (All Tests)</h2>
            {state.testCases.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                    <BarChart data={executionStats} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                        <XAxis dataKey="name" stroke="#A0AEC0" />
                        <YAxis allowDecimals={false} stroke="#A0AEC0" />
                        <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568', borderRadius: '0.25rem' }} 
                            itemStyle={{ color: '#E2E8F0' }}
                            labelStyle={{ color: '#A0AEC0', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ color: '#CBD5E0' }}/>
                        <Bar dataKey="count" name="Test Cases">
                        {executionStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={StatusColors[entry.name]} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <p className="text-gray-500 text-center py-4">No test cases available to display summary.</p>
            )}
        </div>
         {/* Reporting Section */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
             <h2 className="text-xl font-semibold mb-4 text-sky-400 border-b border-gray-700 pb-2">Reporting</h2>
             <p className="text-gray-400 text-sm mb-4">Export test results or a dedicated bug report based on the currently selected filters above.</p>
             <div className="space-y-3">
                 <button onClick={() => handleExport('all')} className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md shadow transition-colors">
                     <FileText size={18} className="mr-2"/> Export Full Test Results (CSV)
                 </button>
                 <button onClick={() => handleExport('bugs')} className="w-full flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow transition-colors">
                    <Bug size={18} className="mr-2"/> Export Bug Report (CSV)
                 </button>
             </div>
        </div>
      </div>


      {isEditModalOpen && testToEdit && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Test Case Execution Details" size="md">
            <div className="space-y-4 text-sm">
                <h4 className="font-semibold text-lg text-sky-300">{testToEdit.title}</h4>
                <p><span className="font-medium text-gray-400">Module:</span> {testToEdit.module}</p>
                <p><span className="font-medium text-gray-400">Type:</span> {testToEdit.type}</p>
                <div>
                    <label htmlFor="modalStatus" className="block font-medium text-gray-300 mb-1">Status</label>
                    <select id="modalStatus" value={testToEdit.status} 
                            onChange={(e) => setTestToEdit(prev => prev ? {...prev, status: e.target.value as TestStatus} : null)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500">
                        {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="modalActualResults" className="block font-medium text-gray-300 mb-1">Actual Results</label>
                    <textarea id="modalActualResults" value={actualResultsInput} 
                              onChange={(e) => setActualResultsInput(e.target.value)}
                              rows={4} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                <div className="flex justify-end space-x-3 pt-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 font-medium rounded-md transition-colors">Cancel</button>
                    <button onClick={handleEditModalSave} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md transition-colors">Save Changes</button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default ResultsTab;