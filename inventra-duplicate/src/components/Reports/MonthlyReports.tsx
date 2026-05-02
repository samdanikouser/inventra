import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';

const data = [
  { name: 'Nov', inventory: 12000, breakage: 400, net: 11600 },
  { name: 'Dec', inventory: 15000, breakage: 600, net: 14400 },
  { name: 'Jan', inventory: 13500, breakage: 350, net: 13150 },
  { name: 'Feb', inventory: 16200, breakage: 800, net: 15400 },
  { name: 'Mar', inventory: 14800, breakage: 200, net: 14600 },
  { name: 'Apr', inventory: 18500, breakage: 1200, net: 17300 },
];

export const MonthlyReports = () => {
  const { state } = useInventory();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Financial Intelligence</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Advanced Inventory Analytics</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> Date Range
          </button>
          <button className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'Asset Growth', value: '+12.5%', trend: 'up', icon: TrendingUp },
             { label: 'Breakage Ratio', value: '1.4%', trend: 'down', icon: TrendingDown },
             { label: 'WAC Fluctuation', value: '±0.8%', trend: 'up', icon: TrendingUp },
             { label: 'In-Stock Rate', value: '96.2%', trend: 'up', icon: TrendingUp },
           ].map((stat, i) => (
             <div key={i} className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                   <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">{stat.label}</p>
                   <stat.icon className={cn("w-4 h-4", stat.trend === 'up' ? "text-emerald-500" : "text-rose-500")} />
                </div>
                <div className="flex items-baseline gap-2">
                   <p className="text-3xl font-light tracking-tighter text-[#1A1A1A]">{stat.value}</p>
                   <span className={cn("text-[10px] font-bold flex items-center gap-0.5", stat.trend === 'up' ? "text-emerald-600" : "text-rose-600")}>
                      {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.trend === 'up' ? 'Increase' : 'Decrease'}
                   </span>
                </div>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
              <div className="flex flex-col mb-8 font-sans">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-1">Stock Value Over Time</h3>
                 <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Monthly Valuation Audit</p>
              </div>
              <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1A1A1A" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#1A1A1A" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={(v) => `KD ${v}`} />
                      <Tooltip 
                        contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontFamily: 'sans-serif' }}
                        itemStyle={{ fontSize: 12, fontWeight: 'bold' }} 
                        labelStyle={{ fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase' }}
                      />
                      <Area type="monotone" dataKey="inventory" stroke="#1A1A1A" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
              <div className="flex flex-col mb-8 font-sans">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-1">Loss vs Performance</h3>
                 <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Breakage Efficiency Analysis</p>
              </div>
              <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                      <Tooltip 
                        contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: 12, fontWeight: 'bold' }} 
                        labelStyle={{ fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase' }}
                      />
                      <Bar dataKey="breakage" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="bg-black text-white rounded-3xl p-10 flex flex-col md:flex-row items-center gap-10">
           <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">Efficiency Insight</span>
                <h3 className="text-4xl font-light tracking-tighter leading-tight italic">Predictive procurement could reduce storage costs by up to 14%.</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed font-sans font-medium">Analyzing historical data patterns indicates that your "Crockery" reorder cycles are 2.4 days too early on average, tying up capital in excess par levels.</p>
           </div>
           <div className="flex gap-4">
              <button className="px-8 py-3 bg-white text-black rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all">Download Audit</button>
              <button className="px-8 py-3 border border-white/20 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all">System Advise</button>
           </div>
        </div>
      </div>
    </div>
  );
};
