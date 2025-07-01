
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { SetupInfo, AppTab } from '../types';
import Alert from './shared/Alert';
import { Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SetupTab: React.FC = () => {
  const { state, dispatch, navigateTo } = useAppContext();
  const [formData, setFormData] = useState<SetupInfo>(state.setupInfo);

  useEffect(() => {
    setFormData(state.setupInfo);
  }, [state.setupInfo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_SETUP_INFO', payload: formData });
    toast.success('Setup information saved!');
  };

  const handleResetAllData = () => {
    if (window.confirm("Are you sure you want to reset ALL application data? This cannot be undone.")) {
        dispatch({ type: 'RESET_STATE' });
        toast.success('All application data has been reset.');
        navigateTo(AppTab.DASHBOARD);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-6 text-sky-400 border-b border-gray-700 pb-3">Application Setup</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="appUrl" className="block text-sm font-medium text-gray-300 mb-1">Target Application URL</label>
            <input
              type="url"
              name="appUrl"
              id="appUrl"
              value={formData.appUrl}
              onChange={handleChange}
              placeholder="https://example.com"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
            />
          </div>
          <div>
            <label htmlFor="appDescription" className="block text-sm font-medium text-gray-300 mb-1">Application Description</label>
            <textarea
              name="appDescription"
              id="appDescription"
              rows={3}
              value={formData.appDescription}
              onChange={handleChange}
              placeholder="e.g., E-commerce platform for selling widgets"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">This description will be used to help AI generate relevant test cases.</p>
          </div>
          <div>
            <label htmlFor="loginDetails" className="block text-sm font-medium text-gray-300 mb-1">Login Credentials (Optional)</label>
            <textarea
              name="loginDetails"
              id="loginDetails"
              rows={2}
              value={formData.loginDetails}
              onChange={handleChange}
              placeholder="e.g., user: test@example.com, pass: Password123 (for reference only)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
            />
             <Alert type="warning" className="mt-2">
              <p className="font-semibold">Security Warning:</p>
              <p>Storing sensitive credentials here is for your local reference only. This application does not encrypt this data and it is stored in your browser's local storage. Do not use real production credentials.</p>
            </Alert>
          </div>
          <div>
            <label htmlFor="googleSheetLink" className="block text-sm font-medium text-gray-300 mb-1">Google Sheet Link (for manual reference)</label>
            <input
              type="url"
              name="googleSheetLink"
              id="googleSheetLink"
              value={formData.googleSheetLink}
              onChange={handleChange}
              placeholder="Link to your Google Sheet test plan (optional)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-500"
            />
             <p className="mt-1 text-xs text-gray-500">This app does not directly integrate with Google Sheets. Use CSV export/import for now.</p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
            >
              <Save size={18} className="mr-2"/>
              Save Setup
            </button>
          </div>
        </form>
      </div>
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg mt-8">
          <h3 className="text-xl font-semibold mb-4 text-red-400 border-b border-gray-700 pb-2">Danger Zone</h3>
          <Alert type="error" title="Reset Application Data">
            <p className="mb-3">This action will permanently delete all setup information, discovered modules, and test cases stored in this application. This cannot be undone.</p>
            <button
                onClick={handleResetAllData}
                className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
            >
                <Trash2 size={18} className="mr-2"/>
                Reset All Data
            </button>
          </Alert>
      </div>
    </div>
  );
};

export default SetupTab;
