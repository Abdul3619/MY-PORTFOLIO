import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Sun, 
  Zap, 
  Battery, 
  TrendingUp, 
  Coins, 
  LayoutGrid, 
  Calculator, 
  ChevronRight, 
  FileCheck, 
  Sparkles, 
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { GlassCard } from '@/components/GlassCard';
import { MagneticButton } from '@/components/MagneticButton';

export default function SolarEstimator() {
  const { t } = useTranslation();
  
  // Calculator Inputs
  const [monthlyBill, setMonthlyBill] = useState(150); // $
  const [electricityRate, setElectricityRate] = useState(0.18); // $ per kWh
  const [sunHours, setSunHours] = useState(5.2); // hours/day
  const [autonomyDays, setAutonomyDays] = useState(1); // 0 (Grid-tied), 1, 2 days of backup
  const [panelWattage, setPanelWattage] = useState(450); // 450W standard
  
  // Calculated outputs
  const [monthlyKwh, setMonthlyKwh] = useState(0);
  const [dailyKwh, setDailyKwh] = useState(0);
  const [recommendedKw, setRecommendedKw] = useState(0);
  const [panelsCount, setPanelsCount] = useState(0);
  const [inverterSize, setInverterSize] = useState(0);
  const [batterySize, setBatterySize] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [annualSavings, setAnnualSavings] = useState(0);
  const [paybackYears, setPaybackYears] = useState(0);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Perform Calculations
  useEffect(() => {
    // 1. Calculate Monthly kWh used
    const kwh = monthlyBill / electricityRate;
    setMonthlyKwh(Math.round(kwh));

    // 2. Daily kWh used
    const daily = kwh / 30;
    setDailyKwh(Number(daily.toFixed(1)));

    // 3. Recommended solar array size in kW (adding 25% for dirt, tilt, inverter and system losses)
    const lossesMultiplier = 1.25;
    const arrayKw = (daily * lossesMultiplier) / sunHours;
    setRecommendedKw(Number(arrayKw.toFixed(2)));

    // 4. Number of panels
    const panels = Math.ceil((arrayKw * 1000) / panelWattage);
    setPanelsCount(panels);

    // 5. Inverter capacity with 15% head margin
    const invKw = arrayKw * 1.15;
    setInverterSize(Number(invKw.toFixed(1)));

    // 6. Battery sizing (for off-grid or hybrid, assuming 48V depth limit and efficiency)
    if (autonomyDays > 0) {
      const batKwh = daily * autonomyDays * 1.25; // 80% discharge limit buffer
      setBatterySize(Number(batKwh.toFixed(1)));
    } else {
      setBatterySize(0);
    }

    // 7. Costs (Estimated $1,150 per kW of solar, plus $650 per kWh of battery storage)
    const solarHardwareCost = arrayKw * 1150;
    const batteryHardwareCost = autonomyDays > 0 ? (daily * autonomyDays * 1.25) * 650 : 0;
    const installationLaborAndInverter = 2200 + (invKw * 150);
    const totalEst = solarHardwareCost + batteryHardwareCost + installationLaborAndInverter;
    setEstimatedCost(Math.round(totalEst));

    // 8. Annual savings (offsetting 92% of the utility bill)
    const savings = monthlyBill * 12 * 0.92;
    setAnnualSavings(Math.round(savings));

    // 9. Payback time in years
    const roi = totalEst / savings;
    setPaybackYears(Number(roi.toFixed(1)));

  }, [monthlyBill, electricityRate, sunHours, autonomyDays, panelWattage]);

  // Form Submission
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    const leadData = {
      name,
      email,
      phone: phone || null,
      company: 'Solar Prospect Design',
      value: estimatedCost,
      source: 'Solar Estimator Pipeline',
      notes: `SOLAR CALCULATION SNAPSHOT:
- Monthly Utility Bill: $${monthlyBill}
- Rate/kWh: $${electricityRate}
- Solar Sizing Recommended: ${recommendedKw} kW
- Panels Estimated: ${panelsCount}x ${panelWattage}W Panels
- Storage Autonomy: ${autonomyDays} Day(s) (${batterySize} kWh Battery Pack)
- Sizing Price Estimate: $${estimatedCost.toLocaleString()}
- Payback Period: ${paybackYears} Years
- User Comments: ${notes || 'None'}`
    };

    try {
      const res = await fetch('/api/leads', { credentials: "include",
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });

      if (!res.ok) {
        throw new Error('Endpoint failure');
      }

      const result = await res.json();
      
      // Save locally as fallback if needed
      if (result.fallback) {
        const cachedLeads = JSON.parse(localStorage.getItem('crm_leads_cache') || '[]');
        leadData.company = 'Local Solar Inbound';
        cachedLeads.unshift({
          id: 'l_loc_' + Date.now(),
          ...leadData,
          status: 'New',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('crm_leads_cache', JSON.stringify(cachedLeads));
      }

      setSubmitStatus('success');
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitStatus('idle');
      }, 3000);
    } catch (err) {
      console.error(err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen py-24 px-4 relative overflow-hidden bg-bg-dark text-white font-sans">
        
        {/* Futuristic Ambient background grids */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#00F0FF_1px,transparent_1px),linear-gradient(to_bottom,#00F0FF_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[#00F0FF]/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-gold/5 blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          
          {/* Main Display Header */}
          <div className="text-center space-y-3">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-widest"
            >
              <Sun size={12} className="animate-pulse" />
              <span>Renewable Sizing Engine v2.4</span>
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl font-kanit font-black tracking-wider uppercase text-cyan-glow bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent"
            >
              Interactive Solar Calculator
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xs md:text-sm font-mono text-gray-400 max-w-xl mx-auto leading-relaxed"
            >
              Calculate your solar energy production capabilities, battery bank autonomy requirements, cost structures, and ROI paybacks instantly.
            </motion.p>
          </div>

          {/* Sizing Grid: Left Inputs / Right Metrics Outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMN 1: INTERACTIVE PARAMS INPUT (Lg: 5/12) */}
            <div className="lg:col-span-5 space-y-6">
              <GlassCard className="p-6 border border-white/8 space-y-6 bg-black/40">
                <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                  <Calculator size={18} className="text-[#00F0FF] cyan-glow-sm" />
                  <h3 className="font-kanit font-black uppercase text-sm tracking-wider text-white">System Configurator</h3>
                </div>

                {/* 1. Monthly Utility Bill slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Monthly Utility Bill</span>
                    <span className="text-white font-bold font-mono">${monthlyBill}</span>
                  </div>
                  <input 
                    type="range" 
                    min="40" 
                    max="1000" 
                    step="10"
                    value={monthlyBill} 
                    onChange={(e) => setMonthlyBill(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-600">
                    <span>$40</span>
                    <span>$1,000</span>
                  </div>
                </div>

                {/* 2. Electricity rate slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Utility Tariff Cost (kWh)</span>
                    <span className="text-[#00F0FF] font-bold font-mono">${electricityRate.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.08" 
                    max="0.55" 
                    step="0.01"
                    value={electricityRate} 
                    onChange={(e) => setElectricityRate(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00F0FF]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-600">
                    <span>$0.08 / kWh</span>
                    <span>$0.55 / kWh</span>
                  </div>
                </div>

                {/* 3. Daily Peak Sun Hours */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Peak Sunlight Hours</span>
                    <span className="text-gold font-bold font-mono">{sunHours.toFixed(1)} hrs/day</span>
                  </div>
                  <input 
                    type="range" 
                    min="2.5" 
                    max="7.5" 
                    step="0.1"
                    value={sunHours} 
                    onChange={(e) => setSunHours(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-600">
                    <span>2.5 hrs (Low)</span>
                    <span>7.5 hrs (Optimal)</span>
                  </div>
                </div>

                {/* 4. Battery Autonomy Toggle Buttons */}
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-mono text-gray-400 mb-1.5">Off-Grid / Hybrid Battery Backup Sizing</span>
                  <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/5 rounded-lg p-1">
                    {[
                      { val: 0, label: 'Grid-Tied (No Battery)' },
                      { val: 1, label: '1 Day Autonomy' },
                      { val: 2, label: '2 Days Backup' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setAutonomyDays(opt.val)}
                        className={`py-2 px-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          autonomyDays === opt.val 
                            ? 'bg-white/10 text-white border border-white/10' 
                            : 'text-gray-500 hover:text-white hover:bg-white/2'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sizing Parameters Information Card */}
                <div className="p-3 bg-white/2 border border-white/4 rounded-md flex items-start gap-2.5 text-[11px] text-gray-400 leading-relaxed font-mono">
                  <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p>
                    Estimates are generated dynamically assuming premium <strong className="text-white">{panelWattage}W Monocrystalline</strong> panels at 18.5% total system yield efficiency coefficients.
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* COLUMN 2: PREMIUM DYNAMIC RESULTS MATRIX (Lg: 7/12) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Financial Dashboard Summary Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Total System Cost */}
                <GlassCard className="p-5 border border-white/8 relative bg-black/40 overflow-hidden group hover:border-[#00F0FF]/30 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-wider">Estimated Project Value</span>
                    <Coins size={15} className="text-[#00F0FF] cyan-glow-sm" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-white mt-2">${estimatedCost.toLocaleString()}</p>
                  <p className="text-[9px] font-mono text-gray-500 mt-1 uppercase">Hardware & professional labor</p>
                </GlassCard>

                {/* Annual Savings */}
                <GlassCard className="p-5 border border-white/8 relative bg-black/40 overflow-hidden group hover:border-emerald-500/30 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-wider">Annual Utility Savings</span>
                    <TrendingUp size={15} className="text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-emerald-400 mt-2">${annualSavings.toLocaleString()}</p>
                  <p className="text-[9px] font-mono text-gray-500 mt-1 uppercase">Offset ~92% of monthly bill</p>
                </GlassCard>

                {/* Sizing Payback Period */}
                <GlassCard className="p-5 border border-white/8 relative bg-black/40 overflow-hidden group hover:border-gold/30 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-wider">Estimated Payback ROI</span>
                    <Sun size={15} className="text-gold" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-white mt-2">{paybackYears} Years</p>
                  <p className="text-[9px] font-mono text-gray-500 mt-1 uppercase">Amortization period timeline</p>
                </GlassCard>
              </div>

              {/* Hardware Sizing breakdown specs */}
              <GlassCard className="p-6 border border-white/8 space-y-6 bg-black/40">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={18} className="text-gold" />
                    <h3 className="font-kanit font-black uppercase text-sm tracking-wider text-white">Recommended Sizing Spec Matrix</h3>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Calculated dynamically</span>
                </div>

                {/* Sizing spec parameters detailed block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Specs */}
                  <div className="space-y-4">
                    
                    {/* Peak Sizing Load */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-[#00F0FF]" />
                        <span className="text-gray-400 font-mono text-xs">Required Solar Capacity</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">{recommendedKw} kW</span>
                    </div>

                    {/* Panels Required */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <LayoutGrid size={14} className="text-[#00F0FF]" />
                        <span className="text-gray-400 font-mono text-xs">Array Sizing Panels</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">{panelsCount}x <span className="text-gray-500 text-xs font-normal">({panelWattage}W)</span></span>
                    </div>

                    {/* Sizing Monthly Demand */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <Sun size={14} className="text-[#00F0FF]" />
                        <span className="text-gray-400 font-mono text-xs">Estimated Monthly Usage</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">{monthlyKwh} kWh</span>
                    </div>
                  </div>

                  {/* Right Specs */}
                  <div className="space-y-4">
                    
                    {/* Inverter size */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gold" />
                        <span className="text-gray-400 font-mono text-xs">Recommended Inverter Sizing</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">{inverterSize} kW</span>
                    </div>

                    {/* Battery Storage */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <Battery size={14} className="text-gold" />
                        <span className="text-gray-400 font-mono text-xs">Inbuilt Battery Storage</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">
                        {batterySize > 0 ? `${batterySize} kWh` : <span className="text-gray-600 font-normal">Grid-Tied</span>}
                      </span>
                    </div>

                    {/* Estimated Daily Generation */}
                    <div className="flex justify-between items-center border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <Sun size={14} className="text-gold" />
                        <span className="text-gray-400 font-mono text-xs">Estimated Daily Generation</span>
                      </div>
                      <span className="text-white font-mono font-bold text-sm">
                        {Number((recommendedKw * sunHours * 0.8).toFixed(1))} kWh
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sizing disclaimer note */}
                <div className="text-[10px] font-mono text-gray-500 leading-relaxed pt-2">
                  * Dynamic estimates calculated using Standard Test Conditions (STC) parameters. Real-world site yields vary depending on geographic location shading profiles, roof pitch azimuth coefficients, and specific inverter topology configurations.
                </div>
              </GlassCard>

              {/* Call-to-Action to lock in design */}
              <div className="flex justify-center pt-2">
                <MagneticButton
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:bg-emerald-600 text-black font-mono font-black uppercase tracking-widest text-xs shadow-[0_4px_20px_rgba(16,185,129,0.3)] border-none"
                >
                  <FileCheck size={15} />
                  <span>Request Custom Engineering Proposal</span>
                </MagneticButton>
              </div>
            </div>
          </div>
        </div>

        {/* PROPOSAL MODAL COMPLETED FORM */}
        <AnimatePresence>
          {isModalOpen && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
              >
                {/* Modal Container */}
                <motion.div
                  initial={{ scale: 0.95, y: 20, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#0c0c0c] border border-white/10 rounded-xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl relative"
                >
                  {/* Modal Header */}
                  <div className="border-b border-white/8 pb-4">
                    <h3 className="text-xl font-kanit font-black uppercase tracking-wider text-[#00F0FF]">
                      Request Solar Sizing Review
                    </h3>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-1">
                      Abdul Wahab Engineering Consultations
                    </p>
                  </div>

                  {submitStatus === 'success' ? (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-8 space-y-3"
                    >
                      <CheckCircle size={48} className="text-emerald-400 mx-auto animate-bounce" />
                      <h4 className="font-kanit font-bold text-lg text-white">Proposal Request Logged!</h4>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto font-mono">
                        Your custom system specs have been integrated into our CRM system as a new qualified project lead. Abdul will evaluate your parameters shortly.
                      </p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmitLead} className="space-y-4">
                      
                      {/* Name input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono uppercase text-gray-400 tracking-wider">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Sultan Al-Ghamdi"
                          className="w-full bg-white/4 border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/30 font-mono text-xs"
                        />
                      </div>

                      {/* Email input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono uppercase text-gray-400 tracking-wider">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="sultan@energy-saudi.com"
                          className="w-full bg-white/4 border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/30 font-mono text-xs"
                        />
                      </div>

                      {/* Phone input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono uppercase text-gray-400 tracking-wider">Phone / WhatsApp (Optional)</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+966-50-123-4567"
                          className="w-full bg-white/4 border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/30 font-mono text-xs"
                        />
                      </div>

                      {/* Additional notes */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono uppercase text-gray-400 tracking-wider">Additional Requirements / Roof Details</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="e.g. Shading from adjacent building on the east corner, flat concrete roof design..."
                          className="w-full bg-white/4 border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/30 font-mono text-xs h-20 resize-none"
                        />
                      </div>

                      {/* Sizing Payload recap info */}
                      <div className="p-3 bg-white/2 border border-white/6 rounded text-[11px] space-y-1 font-mono text-gray-400">
                        <span className="text-[#00F0FF] font-bold uppercase text-[10px] block mb-1">Specs Payload to CRM</span>
                        <div className="flex justify-between">
                          <span>Recommended Solar kW:</span>
                          <span className="text-white font-bold">{recommendedKw} kW</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Battery Autonomy:</span>
                          <span className="text-white font-bold">{autonomyDays > 0 ? `${batterySize} kWh` : 'Grid-Tied'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Value Estimate:</span>
                          <span className="text-white font-bold">${estimatedCost.toLocaleString()}</span>
                        </div>
                      </div>

                      {submitStatus === 'error' && (
                        <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono flex items-start gap-1.5">
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                          <span>Fault committing lead to enterprise database. Check your network or details.</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex justify-end gap-3 pt-3 border-t border-white/8">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          disabled={isSubmitting}
                          className="px-4 py-2 rounded font-mono text-xs font-bold uppercase text-gray-400 hover:text-white transition-colors border border-transparent hover:bg-white/5 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2.5 rounded bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-mono font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? 'Transmitting Specs...' : 'Commit Specs to CRM'}
                        </button>
                      </div>

                    </form>
                  )}

                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </PageTransition>
  );
}
