
import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { TestCase, TestType, ALL_TEST_TYPES, TestStatus } from '../types';
import { generateNextIdForModule, parseTestCasesFromCSV } from '../services/geminiService';
import Modal from './shared/Modal';
import TestCaseForm from './TestCaseForm';
import toast from 'react-hot-toast';
import { PlusCircle, Edit2, Trash2, Upload } from 'lucide-react';

const TestSuiteTab: React.FC = () => {
  const { state, dispatch } = useAppContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  
  const [selectedModuleForFilter, setSelectedModuleForFilter] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const availableModules = useMemo(() => {
    const fromDiscovered = state.discoveredModules.map(m => m.name);
    const fromTestCases = state.testCases.map(tc => tc.module);
    return Array.from(new Set([...fromDiscovered, ...fromTestCases])).filter(Boolean).sort();
  }, [state.discoveredModules, state.testCases]);


  const openAddModal = () => {
    setEditingTestCase(null);
    setIsModalOpen(true);
  };

  const openEditModal = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setIsModalOpen(true);
  };

  const handleDeleteTestCase = (id: string) => {
    if (window.confirm("Are you sure you want to delete this test case?")) {
      dispatch({ type: 'DELETE_TEST_CASE', payload: id });
      toast.success("Test case deleted.");
    }
  };

  const handleFormSubmit = (testCaseData: Omit<TestCase, 'id'> & { id?: string }) => {
    if (editingTestCase && testCaseData.id) {
      dispatch({ type: 'UPDATE_TEST_CASE', payload: testCaseData as TestCase });
      toast.success("Test case updated.");
    } else {
      const newId = generateNextIdForModule(testCaseData.module, state.testCases);
      const newTestCase: TestCase = {
          ...testCaseData,
          id: newId,
          status: TestStatus.PENDING,
      };
      dispatch({ type: 'ADD_TEST_CASES', payload: [newTestCase] });
      toast.success("Test case added.");
    }
    setIsModalOpen(false);
    setEditingTestCase(null);
  };
  
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = parseTestCasesFromCSV(content);
          
          const allTestCases = [...state.testCases];
          const newTestCases: TestCase[] = [];

          parsedData.forEach(data => {
            const newId = generateNextIdForModule(data.module, allTestCases);
            const newTestCase: TestCase = {
                ...data,
                id: newId,
                status: TestStatus.PENDING,
            };
            newTestCases.push(newTestCase);
            allTestCases.push(newTestCase);
          });

          dispatch({ type: 'ADD_TEST_CASES', payload: newTestCases });
          toast.success(`${newTestCases.length} test cases imported from CSV.`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to parse CSV.";
          toast.error(`Import failed: ${errorMessage}`);
          console.error(err);
        }
      };
      reader.readAsText(file);
      event.target.value = ''; // Reset file input
    }
  };


  const filteredTestCases = useMemo(() => {
    return state.testCases.filter(tc => {
      const matchesModule = selectedModuleForFilter ? tc.module === selectedModuleForFilter : true;
      const matchesType = filterType ? tc.type === filterType : true;
      const matchesStatus = filterStatus ? tc.status === filterStatus : true;
      const matchesSearch = searchTerm ? 
        (tc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        tc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tc.id.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      return matchesModule && matchesType && matchesStatus && matchesSearch;
    });
  }, [state.testCases, selectedModuleForFilter, filterType, filterStatus, searchTerm]);


  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4 pb-2 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400">Test Suite ({filteredTestCases.length} / {state.testCases.length})</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={openAddModal} className="flex items-center px-3 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow transition-colors">
                    <PlusCircle size={16} className="mr-1.5"/> Add Manually
                </button>
                <label className="flex items-center px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md shadow transition-colors cursor-pointer">
                    <Upload size={16} className="mr-1.5"/> Import CSV
                    <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                </label>
            </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label htmlFor="selectedModuleFilter" className="block text-sm font-medium text-gray-300 mb-1">Filter by Module</label>
            <select id="selectedModuleFilter" value={selectedModuleForFilter} onChange={(e) => setSelectedModuleForFilter(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
              <option value="">All Modules</option>
              {availableModules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filterType" className="block text-sm font-medium text-gray-300 mb-1">Filter by Type</label>
            <select id="filterType" value={filterType} onChange={(e) => setFilterType(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
              <option value="">All Types</option>
              {ALL_TEST_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
           <div>
            <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-300 mb-1">Filter by Status</label>
            <select id="filterStatus" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500 text-sm">
              <option value="">All Statuses</option>
              {Object.values(TestStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-300 mb-1">Search ID/Title/Desc</label>
            <input type="text" id="searchTerm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search..."
                   className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500 text-sm"/>
          </div>
        </div>

        {/* Test Cases Table/List */}
        <div className="overflow-x-auto max-h-[600px] pr-1">
          {filteredTestCases.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-700 text-sm">
              <thead className="bg-gray-750 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300">ID</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300">Title</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300 hidden md:table-cell">Module</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300 hidden lg:table-cell">Type</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredTestCases.slice().reverse().map(tc => (
                  <tr key={tc.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{tc.id}</td>
                    <td className="px-4 py-3 text-gray-200">
                        {tc.title}
                        <p className="text-xs text-gray-400 hidden sm:block truncate max-w-xs" title={tc.description}>{tc.description}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{tc.module}</td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{tc.type}</td>
                    <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            tc.status === TestStatus.PASSED ? 'bg-green-700 text-green-200' :
                            tc.status === TestStatus.FAILED ? 'bg-red-700 text-red-200' :
                            tc.status === TestStatus.BLOCKED ? 'bg-yellow-700 text-yellow-200' :
                            'bg-gray-600 text-gray-300' 
                        }`}>{tc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openEditModal(tc)} title="Edit" className="hover:text-sky-400"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteTestCase(tc.id)} title="Delete" className="hover:text-red-400"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No test cases found. {state.testCases.length > 0 ? "Try adjusting filters." : "Generate some test cases in the 'Test Generation' tab!"}
            </p>
          )}
        </div>
      </div>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTestCase ? "Edit Test Case" : "Add New Test Case"} size="lg">
          <TestCaseForm 
            initialData={editingTestCase} 
            onSubmit={handleFormSubmit}
            onCancel={() => setIsModalOpen(false)}
            moduleName={selectedModuleForFilter || editingTestCase?.module || "General"}
          />
        </Modal>
      )}
    </div>
  );
};

export default TestSuiteTab;
