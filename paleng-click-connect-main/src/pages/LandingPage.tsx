import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard, BarChart3, Bell, QrCode, Shield, Users,
  ArrowRight, CheckCircle2, MapPin, Phone, Mail,
} from "lucide-react";

const features = [
  { icon: CreditCard, title: "Digital Payments", description: "Pay stall fees via GCash, PayMaya, Instapay, or cash — anytime, anywhere." },
  { icon: BarChart3, title: "Staggered Installments", description: "Flexible payment plans that match your financial capacity. No more missed deadlines." },
  { icon: Bell, title: "SMS Reminders", description: "Automated notifications for due dates, confirmations, and municipal announcements." },
  { icon: QrCode, title: "QR Identification", description: "Unique QR codes for every stall — fast verification and payment reference." },
  { icon: Shield, title: "Secure & Transparent", description: "HTTPS encryption, audit logs, and role-based access for complete data security." },
  { icon: Users, title: "Admin Dashboard", description: "Real-time analytics for collections, delinquency tracking, and vendor management." },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

const LandingPage = () => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const { data: realStats } = useQuery({
    queryKey: ['landing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_landing_page_stats');

      if (error) {
        console.error("Error fetching landing stats:", error);
        return { vendorCount: 955, delinquencyRate: 20.01 };
      }

      return (data as unknown) as { vendorCount: number, delinquencyRate: number };
    }
  });

  const displayStats = [
    { label: "Active Stallholders", value: realStats?.vendorCount ?? "955", suffix: "" },
    { label: "Current Delinquency", value: realStats?.delinquencyRate ?? "20.01", suffix: "%" },
    { label: "Target Reduction", value: "50", suffix: "%" },
    { label: "Payment Methods", value: "4", suffix: "+" },
  ]; 
  
  return (
    <div className="min-h-screen overflow-x-hidden font-serif bg-[#f8f5f0]">
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-[#f8f5f0]/95 backdrop-blur-md border-b border-[#d4c9b8] sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] sm:h-[68px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 no-underline">
            <div className="w-8 h-8 sm:w-[42px] sm:h-[42px] rounded-lg overflow-hidden shadow-sm flex-shrink-0">
              <img src="/favicon.png" alt="PALENG-CLICK" className="w-full h-full object-contain" loading="lazy" />
            </div>
            <div>
              <div className="font-bold text-[13px] sm:text-[16px] text-[#1a2e1a] tracking-wide font-serif">PALENG-CLICK</div>
              <div className="text-[9px] sm:text-[10px] text-[#6b7c6b] tracking-wider uppercase hidden sm:block">San Juan, Batangas</div>
            </div>
          </Link>
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden md:flex gap-7">
              {["Features", "About", "Impact"].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-[13px] text-[#4a5e4a] no-underline tracking-wide hover:text-[#1a4a2e] transition-colors font-serif">
                  {item}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/apply" className="hidden sm:block">
                <button className="bg-transparent text-[#1a4a2e] border border-[#1a4a2e] rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-[12px] font-semibold cursor-pointer tracking-wide font-serif hover:bg-[#1a4a2e]/5 transition-colors">
                  Apply as Vendor
                </button>
              </Link>
              <Link to="/login">
                <button className="flex items-center gap-1.5 sm:gap-2 text-[#f0e6c8] border-none rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-[12px] font-semibold cursor-pointer tracking-wide font-serif bg-gradient-to-br from-[#1a4a2e] to-[#2d7a4f] shadow-sm hover:opacity-90 transition-opacity">
                  Login <ArrowRight size={14} className="hidden sm:block" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-[92vh] flex items-center overflow-hidden pb-12 sm:pb-0">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <img src="/market.jpg" alt="San Juan Public Market" className="w-full h-[115%] object-cover object-center" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1e0f]/90 via-[#0a1e0f]/75 to-[#0a1e0f]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1e0f]/60 to-transparent h-3/5 top-auto" />
        </motion.div>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-20">
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 sm:gap-2.5 bg-[#c9a84c]/15 border border-[#c9a84c]/40 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-7">
              <MapPin size={12} className="text-[#c9a84c] flex-shrink-0 sm:w-[13px] sm:h-[13px]" />
              <span className="text-[#e8c86e] text-[9px] sm:text-[11px] tracking-[1.5px] uppercase font-serif text-left">Pamilihang Bayan ng San Juan, Batangas</span>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-[#f0e6c8] text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.08] font-serif max-w-[780px] mb-2 sm:mb-3">
              Your Stall,<br className="sm:hidden" />{" "}<span className="text-[#e8c86e] italic">Dignified.</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-[#c9a84c]/80 text-[10px] sm:text-[12px] tracking-[2px] sm:tracking-[3px] uppercase mb-4 sm:mb-6 font-serif">
              Para sa mga Magtitinda ng San Juan
            </motion.p>
            <motion.p variants={fadeUp} custom={3} className="text-[#f0e6c8]/80 text-[13px] sm:text-[16px] lg:text-[18px] leading-relaxed max-w-[580px] mb-8 sm:mb-10 font-serif">
              A modern digital platform that empowers San Juan&apos;s 955 stallholders — streamlining stall fee payments through secure, accessible, and transparent technology.
            </motion.p>

            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-[400px] sm:max-w-none mb-10 sm:mb-12">
              <Link to="/login" className="block w-full sm:w-auto">
                <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] rounded-md py-3 sm:py-3.5 px-6 sm:px-8 font-bold text-[14px] sm:text-[15px] tracking-wide shadow-lg hover:shadow-xl transition-all font-serif">
                  Login to Portal <ArrowRight size={16} />
                </button>
              </Link>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <Link to="/apply" className="block w-full sm:w-auto">
                  <button className="w-full flex items-center justify-center bg-transparent text-[#f0e6c8] border border-[#f0e6c8]/30 rounded-md py-3 sm:py-3.5 px-6 sm:px-8 text-[13px] sm:text-[14px] tracking-wide hover:bg-[#f0e6c8]/10 transition-all font-serif">
                    Apply for a Stall
                  </button>
                </Link>
                <a href="#features" className="block w-full sm:w-auto">
                  <button className="w-full flex items-center justify-center bg-transparent text-[#f0e6c8] border border-[#f0e6c8]/30 rounded-md py-3 sm:py-3.5 px-6 sm:px-8 text-[13px] sm:text-[14px] tracking-wide hover:bg-[#f0e6c8]/10 transition-all font-serif">
                    Learn More
                  </button>
                </a>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={5} className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-6">
              {["Free for vendors", "Secure payments", "SMS alerts", "LGU-powered"].map(t => (
                <span key={t} className="flex items-center gap-1.5 sm:gap-2 text-[#e8c86e]/90 text-[11px] sm:text-[13px] font-serif">
                  <CheckCircle2 size={13} className="text-[#c9a84c] flex-shrink-0 sm:w-[14px] sm:h-[14px]" /> {t}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0 h-20 sm:h-32 bg-gradient-to-b from-transparent to-[#f8f5f0]" />
      </section>

      {/* ── STATS BAND ──────────────────────────────────────────────────────── */}
      <section id="impact" className="bg-[#1a2e1a] py-12 sm:py-16 px-4 sm:px-6 relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-8 sm:mb-11">
            <p className="text-[#c9a84c] text-[10px] sm:text-[11px] tracking-[3px] uppercase mb-2 font-serif">By the Numbers</p>
            <h2 className="text-[#f0e6c8] text-2xl sm:text-3xl lg:text-4xl font-bold font-serif">The Challenge We&apos;re Solving</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 sm:gap-y-0 divide-x-0 sm:divide-x divide-[rgba(201,168,76,0.2)]">
            {displayStats.map((stat, i) => (
              <motion.div key={stat.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="text-center px-4 sm:px-6 py-2 sm:py-9">
                <div className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-[#e8c86e] leading-none">
                  {stat.value}<span className="text-[0.55em] text-[#c9a84c]">{stat.suffix}</span>
                </div>
                <div className="text-[#f0e6c8]/65 text-[10px] sm:text-xs mt-2 sm:mt-3 tracking-wide font-serif">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
      </section>

      {/* ── MUNICIPAL HALL SECTION ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-2 min-h-[350px] lg:min-h-[520px]">
          <div className="relative h-[220px] sm:h-[320px] lg:h-auto lg:min-h-[320px] overflow-hidden order-1 lg:order-none">
            <img src="/hall.jpg" alt="Municipal Hall of San Juan Batangas" className="w-full h-full object-cover object-top" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-transparent via-transparent to-[#f8f5f0]" />
            <div className="absolute inset-4 border border-[#c9a84c]/30 pointer-events-none hidden lg:block" />
          </div>
          <div className="bg-[#f8f5f0] px-5 py-10 sm:px-10 lg:px-14 lg:py-16 flex flex-col justify-center order-2 lg:order-none">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.p variants={fadeUp} custom={0} className="text-[#c9a84c] text-[10px] sm:text-[11px] tracking-[3px] uppercase font-serif mb-3 sm:mb-4">Municipality of San Juan</motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-4 sm:mb-6">
                Serving the Heart of<br /><em className="text-[#2d7a4f] not-italic lg:italic">Batangas Commerce</em>
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-[#5a6e5a] text-[13px] sm:text-[15px] leading-relaxed font-serif mb-4 sm:mb-5">
                The San Juan Public Market sits on 1.92 hectares at the heart of the municipality&apos;s commercial district — home to 955 stallholders including awarded stalls, fish retailers, meat retailers, and dry goods vendors.
              </motion.p>
              <motion.p variants={fadeUp} custom={3} className="text-[#5a6e5a] text-[13px] sm:text-[15px] leading-relaxed font-serif mb-6 sm:mb-8">
                PALENG-CLICK bridges modern technology with the municipality&apos;s commitment to transparent, efficient governance for every stallholder.
              </motion.p>
              <motion.div variants={fadeUp} custom={4} className="flex gap-2 flex-wrap">
                {["LGU San Juan", "1.92 hectares", "955 Stallholders", "Since 2026"].map(tag => (
                  <span key={tag} className="bg-[#2d7a4f]/10 border border-[#2d7a4f]/20 text-[#2d7a4f] rounded-full px-3 py-1 text-[10px] sm:text-[12px] font-serif">{tag}</span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className="bg-[#1a2e1a] py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(45,122,79,0.15)_0%,transparent_60%),radial-gradient(circle_at_80%_20%,rgba(201,168,76,0.08)_0%,transparent_50%)]" />
        <div className="max-w-[1200px] mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10 sm:mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-[#c9a84c] text-[10px] sm:text-[11px] tracking-[3px] uppercase font-serif mb-2 sm:mb-3">Platform Features</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-[#f0e6c8] font-serif text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">Built for the Pamilihang Bayan</motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-[#f0e6c8]/60 text-[13px] sm:text-[15px] font-serif max-w-[560px] mx-auto leading-relaxed">
              A comprehensive platform designed specifically for San Juan&apos;s stallholders and municipal administrators.
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] border border-[#c9a84c]/20 rounded-xl overflow-hidden bg-[#c9a84c]/20">
            {features.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="p-6 sm:p-8 bg-[#1a2e1a] transition-colors cursor-default hover:bg-[#2d7a4f]/10">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#c9a84c]/10 border border-[#c9a84c]/25 rounded-lg flex items-center justify-center mb-4 sm:mb-5">
                  <f.icon className="text-[#c9a84c] w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                </div>
                <h3 className="text-[#f0e6c8] font-serif text-[16px] sm:text-[17px] font-bold mb-2">{f.title}</h3>
                <p className="text-[#f0e6c8]/55 text-[12.5px] sm:text-[13.5px] leading-relaxed font-serif">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT / WHY ───────────────────────────────────────────────────────── */}
      <section id="about" className="bg-[#f8f5f0] py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-12 sm:h-20 bg-gradient-to-b from-[#1a2e1a] to-transparent" />
        <div className="max-w-[800px] mx-auto text-center mt-6 sm:mt-0">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.p variants={fadeUp} custom={0} className="text-[#c9a84c] text-[10px] sm:text-[11px] tracking-[3px] uppercase font-serif mb-3 sm:mb-4">Our Mission</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1a2e1a] mb-6 sm:mb-8 leading-tight">Why PALENG-CLICK?</motion.h2>
            <motion.div variants={fadeUp} custom={2} className="flex gap-2.5 sm:gap-4 justify-center mb-8 sm:mb-10 flex-wrap">
              {[
                ["13.94%", "Delinquency 2023"],
                [`${realStats?.delinquencyRate ?? 20.01}%`, "Current Delinquency"],
                ["50%", "Reduction Target"]
              ].map(([val, lbl]) => (
                <div key={lbl} className="bg-white border border-[#ddd5c5] rounded-xl p-3 sm:p-5 text-center min-w-[100px] sm:min-w-[140px] flex-1 sm:flex-none">
                  <div className={`font-serif text-[1.4rem] sm:text-[1.8rem] font-bold leading-none ${val === "50%" ? "text-[#2d7a4f]" : "text-[#b34a2a]"}`}>{val}</div>
                  <div className="text-[#7a8a7a] text-[9px] sm:text-[11px] mt-1.5 sm:mt-2 font-serif tracking-wide">{lbl}</div>
                </div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} custom={3} className="text-[#5a6e5a] text-[13px] sm:text-[15.5px] leading-relaxed font-serif text-left bg-white border border-[#ddd5c5] rounded-xl p-5 sm:p-9 lg:p-10 shadow-sm">
              <p className="mb-4">
                The San Juan Public Market is the center of daily commerce for the municipality — a vibrant hub serving hundreds of families who depend on it for their livelihood and daily needs.
              </p>
              <p className="mb-4">
                However, stall payment delinquency rose from <strong className="text-[#1a2e1a]">13.94% in 2023</strong> to <strong className="text-[#b34a2a]">{realStats?.delinquencyRate ?? 20.01}% currently</strong>, threatening the LGU&apos;s revenue and its capacity to fund essential public services for all citizens of San Juan.
              </p>
              <p>
                PALENG-CLICK addresses this by offering accessible online payments, staggered installment options, automated reminders, and comprehensive administrative tools — creating a more resilient and transparent public market.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="relative min-h-[300px] sm:min-h-[380px] flex items-center py-16 px-4">
          <img src="/market.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-[#0a190c]/90" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
          <div className="relative z-10 max-w-[1200px] mx-auto text-center w-full">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.p variants={fadeUp} custom={0} className="text-[#c9a84c] text-[10px] sm:text-[11px] tracking-[3px] uppercase font-serif mb-3 sm:mb-4">Ready to Get Started?</motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-[#f0e6c8] font-serif text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-5 leading-tight">Join San Juan&apos;s Digital Market</motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-[#f0e6c8]/70 font-serif text-[12.5px] sm:text-[15px] mb-8 max-w-[500px] mx-auto">
                Stallholders and municipal staff — log in to start managing payments the modern way.
              </motion.p>
              <motion.div variants={fadeUp} custom={3}>
                <Link to="/login" className="inline-block w-full sm:w-auto">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] border-none rounded-md py-3 sm:py-3.5 px-6 sm:px-8 text-[13px] sm:text-[15px] font-bold cursor-pointer tracking-wide font-serif shadow-[0_4px_24px_rgba(201,168,76,0.4)] hover:shadow-[0_6px_32px_rgba(201,168,76,0.5)] transition-all">
                    Login to PALENG-CLICK <ArrowRight size={16} />
                  </button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0f1e0f] pt-12 pb-8 px-5 sm:px-6 border-t border-[#c9a84c]/20">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md overflow-hidden flex-shrink-0">
                  <img src="/favicon.png" alt="PALENG-CLICK" className="w-full h-full object-contain" loading="lazy" />
                </div>
                <span className="text-[#f0e6c8] font-bold font-serif text-[14px] sm:text-[15px]">PALENG-CLICK</span>
              </div>
              <p className="text-[#f0e6c8]/50 text-[12px] sm:text-[13px] font-serif leading-relaxed">
                Digital payment system for San Juan Public Market stallholders.
              </p>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-[#c9a84c] font-serif text-[11px] sm:text-[12px] tracking-[2px] uppercase mb-4">Contact</h4>
              {[
                { icon: MapPin, text: "San Juan Public Market, San Juan, Batangas" },
                { icon: Phone, text: "Municipal Treasurer&apos;s Office" },
                { icon: Mail, text: "Municipality of San Juan, Batangas" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2.5 mb-3">
                  <Icon className="text-[#c9a84c] mt-0.5 flex-shrink-0 w-[12px] h-[12px] sm:w-[13px] sm:h-[13px]" />
                  <span className="text-[#f0e6c8]/55 text-[12px] sm:text-[13px] font-serif leading-snug">{text}</span>
                </div>
              ))}
            </div>
            {/* Quick links */}
            <div>
              <h4 className="text-[#c9a84c] font-serif text-[11px] sm:text-[12px] tracking-[2px] uppercase mb-4">Quick Links</h4>
              {[["Login", "login"], ["Features", "#features"], ["About", "#about"]].map(([label, href]) => (
                <div key={label} className="mb-2.5">
                  {href.startsWith("#")
                    ? <a href={href} className="text-[#f0e6c8]/55 hover:text-[#c9a84c] text-[12px] sm:text-[13px] font-serif no-underline transition-colors">{label}</a>
                    : <Link to={`/${href}`} className="text-[#f0e6c8]/55 hover:text-[#c9a84c] text-[12px] sm:text-[13px] font-serif no-underline transition-colors">{label}</Link>}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[#c9a84c]/15 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[#f0e6c8]/35 text-[10px] sm:text-[12px] font-serif text-center sm:text-left">© 2026 Municipality of San Juan, Batangas. All rights reserved.</p>
            <p className="text-[#f0e6c8]/25 text-[9px] sm:text-[11px] font-serif tracking-[1px] text-center sm:text-right">PALENG-CLICK SYSTEM · LGU SAN JUAN</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;