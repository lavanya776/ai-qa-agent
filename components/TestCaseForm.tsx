import React, { useState, useEffect } from 'react';
import { TestCase, TestType, ALL_TEST_TYPES, TestStatus } from '../types';
import { Save, Plus, Trash2 } from 'lucide-react';

interface TestCaseFormProps {
  initialData?: TestCase | null;
  onSubmit: (testCaseData: Omit<TestCase, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  moduleName: string; // To pre-fill or associate
}

const TestCaseForm: React.FC<TestCaseFormProps> = ({ initialData, onSubmit, onCancel, moduleName }) => {
  const emptyTestCase: Omit<TestCase, 'id'> = {
    title: '',
    description: '',
    steps: [''],
    expectedResults: '',
    type: TestType.FUNCTIONAL,
    module: moduleName,
    status: TestStatus.PENDING,
  };

  const [testCase, setTestCase] = useState<Omit<TestCase, 'id' | 'status'> & { id?: string; status?: TestStatus }>(
    initialData ? { ...initialData } : { ...emptyTestCase, module: moduleName }
  );

  useEffect(() => {
    if (initialData) {
      setTestCase({ ...initialData });
    } else {
      setTestCase({ ...emptyTestCase, module: moduleName });
    }
  }, [initialData, moduleName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTestCase(prev => ({ ...prev, [name]: value }));
  };

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...testCase.steps];
    newSteps[index] = value;
    setTestCase(prev => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    setTestCase(prev => ({ ...prev, steps: [...prev.steps, ''] }));
  };

  const removeStep = (index: number) => {
    if (testCase.steps.length <= 1) return; // Must have at least one step
    const newSteps = testCase.steps.filter((_, i) => i !== index);
    setTestCase(prev => ({ ...prev, steps: newSteps }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (testCase.steps.some(s => s.trim() === '')) {
        alert("All steps must be filled out.");
        return;
    }
    const finalTestCaseData = {
      ...testCase,
      status: testCase.status || TestStatus.PENDING,
      module: testCase.module || moduleName,
    };
    onSubmit(finalTestCaseData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div>
        <label htmlFor="title" className="block font-medium text-gray-300 mb-1">Title</label>
        <input type="text" name="title" id="title" value={testCase.title} onChange={handleChange} required 
               className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"/>
      </div>
      <div>
        <label htmlFor="module" className="block font-medium text-gray-300 mb-1">Module</label>
        <input type="text" name="module" id="module" value={testCase.module} onChange={handleChange} required
               className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"/>
      </div>
      <div>
        <label htmlFor="description" className="block font-medium text-gray-300 mb-1">Description</label>
        <textarea name="description" id="description" value={testCase.description} onChange={handleChange} rows={2}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"/>
      </div>
      <div>
        <label className="block font-medium text-gray-300 mb-1">Steps</label>
        {testCase.steps.map((step, index) => (
          <div key={index} className="flex items-center space-x-2 mb-2">
            <input type="text" value={step} onChange={(e) => handleStepChange(index, e.target.value)} required
                   className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"/>
            <button type="button" onClick={() => removeStep(index)} disabled={testCase.steps.length <= 1}
                    className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 size={16}/>
            </button>
          </div>
        ))}
        <button type="button" onClick={addStep} className="mt-1 flex items-center text-sm text-sky-400 hover:text-sky-300">
          <Plus size={16} className="mr-1"/> Add Step
        </button>
      </div>
      <div>
        <label htmlFor="expectedResults" className="block font-medium text-gray-300 mb-1">Expected Results</label>
        <textarea name="expectedResults" id="expectedResults" value={testCase.expectedResults} onChange={handleChange} required rows={2}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500"/>
      </div>
      <div>
        <label htmlFor="type" className="block font-medium text-gray-300 mb-1">Type</label>
        <select name="type" id="type" value={testCase.type} onChange={handleChange} required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-sky-500 focus:border-sky-500">
          {ALL_TEST_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 font-medium rounded-md transition-colors">
          Cancel
        </button>
        <button type="submit" 
                className="flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md transition-colors">
          <Save size={18} className="mr-2"/> {initialData ? 'Save Changes' : 'Add Test Case'}
        </button>
      </div>
    </form>
  );
};

export default TestCaseForm;