import React from 'react';
import { useAppContext } from '../context/AppContext';
import { TestStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, ListChecks, Percent, Bug, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

const StatusColors: Record<TestStatus, string> = {
  [TestStatus.PASSED]: '#48BB78', // green-500
  [TestStatus.FAILED]: '#F56565', // red-500
  [TestStatus.BLOCKED]: '#ECC94B', // yellow-500
  [TestStatus.PENDING]: '#718096', // gray-500
};

const DashboardTab: React.FC = () => {
  const { state } = useAppContext();
  const { discoveredModules, testCases } = state;

  const totalModules = discoveredModules.length;
  const totalTestCases = testCases.length;

  const executionStats = React.useMemo(() => {
    const stats: Record<TestStatus, number> = {
      [TestStatus.PENDING]: 0,
      [TestStatus.PASSED]: 0,
      [TestStatus.FAILED]: 0,
      [TestStatus.BLOCKED]: 0,
    };
    testCases.forEach(tc => {
      stats[tc.status]++;
    });
    return stats;
  }, [testCases]);

  const bugsFound = executionStats[TestStatus.FAILED] + executionStats[TestStatus.BLOCKED];
  const executedTests = executionStats[TestStatus.PASSED] + executionStats[TestStatus.FAILED] + executionStats[TestStatus.BLOCKED];
  const passRate = executedTests > 0 ? Math.round((executionStats[TestStatus.PASSED] / executedTests) * 100) : 0;

  const pieChartData = Object.entries(executionStats)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }));

  const testCasesByModule = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    testCases.forEach(tc => {
      counts[tc.module] = (counts[tc.module] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // Sort descending
  }, [testCases]);

  const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, subtext?: string, colorClass: string }> = ({ icon, title, value, subtext, colorClass }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-4">
      <div className={`p-3 rounded-full ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
      </div>
    </div>
  );
  
  if (totalTestCases === 0 && totalModules === 0) {
    return (
        <div className="text-center p-10 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-sky-400 mb-4">Welcome to the AI QA Agent!</h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-6">
                This dashboard will give you a high-level overview of your project's health once you add some data.
            </p>
            <p className="text-gray-400">
                To get started, please go to the <strong className="text-sky-300">Setup</strong> tab to enter your application details,
                then use the <strong className="text-sky-300">AI Discovery</strong> tab to find your application's modules.
            </p>
        </div>
    );
  }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-sky-400">Project Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Package size={24} />} title="Total Modules" value={totalModules} colorClass="bg-blue-900/50 text-blue-300" />
        <StatCard icon={<ListChecks size={24} />} title="Total Test Cases" value={totalTestCases} colorClass="bg-indigo-900/50 text-indigo-300" />
        <StatCard icon={<Percent size={24} />} title="Pass Rate" value={`${passRate}%`} subtext={`${executedTests} tests executed`} colorClass="bg-green-900/50 text-green-300" />
        <StatCard icon={<Bug size={24} />} title="Bugs Found" value={bugsFound} subtext="Failed or Blocked tests" colorClass="bg-red-900/50 text-red-300" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 p-6 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-sky-400">Test Status Distribution</h2>
            {testCases.length > 0 ? (
                <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                    return (
                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                        {`${(percent * 100).toFixed(0)}%`}
                                    </text>
                                    );
                                }}
                            >
                                {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={StatusColors[entry.name as TestStatus]} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568', borderRadius: '0.25rem' }} 
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
                        {Object.entries(StatusColors).map(([status, color]) => (
                            <div key={status} className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></span>
                                <span className="text-gray-300">{status} ({executionStats[status as TestStatus]})</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 text-center py-10">No test cases to display.</p>
            )}
        </div>
        
        <div className="lg:col-span-3 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-sky-400">Test Coverage by Module</h2>
          {testCasesByModule.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={testCasesByModule} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" horizontal={false} />
                  <XAxis type="number" stroke="#A0AEC0" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#A0AEC0" width={100} tick={{ fontSize: 12 }} interval={0} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568' }}
                    cursor={{fill: '#4A556850'}}
                  />
                  <Legend wrapperStyle={{ color: '#CBD5E0' }} />
                  <Bar dataKey="count" name="Test Cases" fill="#2B6CB0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
           ) : (
             <p className="text-gray-500 text-center py-10">No modules with test cases to display.</p>
           )}
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
