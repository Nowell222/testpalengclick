import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  CreditCard, BarChart3, Bell, QrCode, Shield, Users,
  ArrowRight, CheckCircle2, MapPin, Phone, Mail,
} from "lucide-react";
import { useRef } from "react";

const stats = [
  { label: "Active Stallholders", value: "955",   suffix: ""  },
  { label: "Delinquency 2024",    value: "20.01", suffix: "%" },
  { label: "Target Reduction",    value: "50",    suffix: "%" },
  { label: "Payment Methods",     value: "4",     suffix: "+" },
];

const features = [
  { icon: CreditCard, title: "Digital Payments",        description: "Pay stall fees via GCash, PayMaya, InstaPay, or cash — anytime, anywhere, without leaving your stall." },
  { icon: BarChart3,  title: "Staggered Installments",  description: "Flexible payment plans that match your financial capacity. No more missed deadlines." },
  { icon: Bell,       title: "SMS Reminders",            description: "Automated notifications for due dates, confirmations, and important municipal announcements." },
  { icon: QrCode,     title: "QR Identification",       description: "Unique QR codes for every stall — fast verification and instant payment reference." },
  { icon: Shield,     title: "Secure & Transparent",    description: "HTTPS encryption, audit logs, and role-based access for complete data security." },
  { icon: Users,      title: "Admin Dashboard",         description: "Real-time analytics for collections, delinquency tracking, and vendor management." },
];

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

const LandingPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-[#1a3a6e]/10 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0"><img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            <div className="leading-none">
              <span className="block text-base font-bold text-[#1a3a6e] tracking-wide" style={{ fontFamily: "Georgia, serif" }}>PALENG-CLICK</span>
              <span className="block text-[10px] text-[#8a9ab5] tracking-widest uppercase">San Juan, Batangas</span>
            </div>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {[["Features","#features"],["About","#about"],["Impact","#impact"]].map(([l,h]) => (
              <a key={l} href={h} className="text-sm text-[#4a5a7a] hover:text-[#1a3a6e] transition-colors font-medium">{l}</a>
            ))}
          </div>
          <Link to="/login">
            <Button className="bg-[#1a3a6e] hover:bg-[#152f5a] text-white rounded-lg gap-2 px-5 shadow-sm">
              Login <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative h-[92vh] min-h-[600px] flex items-center overflow-hidden">
        <motion.div className="absolute inset-0 w-full h-full" style={{ y: parallaxY }}>
          <img src="/market.jpg" alt="Pamilihang Bayan ng San Juan Batangas" className="w-full h-full object-cover object-center scale-110" />
        </motion.div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(10,24,52,0.88) 0%, rgba(26,58,110,0.72) 50%, rgba(10,24,52,0.82) 100%)" }} />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c9a84c] via-[#e8c96a] to-[#c9a84c]" />

        <div className="container relative mx-auto px-4 md:px-8 z-10">
          <motion.div initial="hidden" animate="visible" className="max-w-2xl">
            <motion.div variants={fadeUp} custom={0} className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5 text-[#e8c96a]" />
              <span className="text-xs font-medium text-white/90 tracking-widest uppercase">Pamilihang Bayan ng San Juan, Batangas</span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="mb-5 text-5xl font-bold leading-tight text-white md:text-7xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
              Bayad na.<br />
              <span className="text-[#e8c96a]">Madali, Mabilis,</span><br />
              Mapagkakatiwalaan.
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mb-8 max-w-lg text-base text-white/80 leading-relaxed md:text-lg">
              PALENG-CLICK modernizes stall fee collection at the San Juan Public Market —
              bringing digital payments and transparency to 955 stallholders.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-3">
              <Link to="/login">
                <Button className="bg-[#e8c96a] hover:bg-[#d4b458] text-[#1a1a1a] font-semibold px-7 py-3 h-auto rounded-lg gap-2 text-base shadow-lg">
                  Magsimula <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:border-white/50 bg-transparent px-7 py-3 h-auto rounded-lg text-base">
                  Alamin pa
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="mt-10 flex flex-wrap gap-5 text-sm text-white/70">
              {["Libre para sa mga vendor","Ligtas na pagbabayad","SMS notifications"].map(t => (
                <span key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#e8c96a]" /> {t}</span>
              ))}
            </motion.div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* STATS */}
      <section id="impact" className="relative -mt-6 z-10">
        <div className="container mx-auto px-4 md:px-8">
          <div className="rounded-2xl border border-[#1a3a6e]/10 bg-white shadow-xl shadow-[#1a3a6e]/5 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-[#1a3a6e]/8 md:grid-cols-4 md:divide-y-0">
              {stats.map((stat, i) => (
                <motion.div key={stat.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                  className="flex flex-col items-center justify-center px-6 py-8 text-center">
                  <div className="font-bold text-[#1a3a6e]" style={{ fontSize: "2.5rem", lineHeight: 1, fontFamily: "Georgia, serif" }}>
                    {stat.value}<span className="text-[#c9a84c]">{stat.suffix}</span>
                  </div>
                  <div className="mt-2 text-xs text-[#6a7a9a] tracking-wide uppercase">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT WITH HALL PHOTO */}
      <section id="about" className="py-24 md:py-32">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative order-2 md:order-1">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-[#1a3a6e]/15">
                <img src="/hall.jpg" alt="Municipal Hall of San Juan Batangas" className="w-full h-72 object-cover object-center md:h-96" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a1834]/50 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xs text-white/80 font-medium tracking-widest uppercase">Municipal Hall · San Juan, Batangas</p>
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 h-full w-full rounded-2xl border-2 border-[#c9a84c]/30 -z-10" />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="order-1 md:order-2 space-y-5">
              <motion.div variants={fadeUp} custom={0}>
                <span className="text-xs font-semibold tracking-widest uppercase text-[#c9a84c]">Tungkol sa PALENG-CLICK</span>
                <h2 className="mt-2 text-3xl font-bold text-[#0a1834] md:text-4xl leading-tight" style={{ fontFamily: "Georgia, serif" }}>
                  Bakit kailangan ng<br /><span className="text-[#1a3a6e]">PALENG-CLICK?</span>
                </h2>
              </motion.div>
              <motion.div variants={fadeUp} custom={1} className="space-y-4 text-[#4a5a7a] leading-relaxed" style={{ fontSize: "0.95rem" }}>
                <p>The San Juan Public Market spans <strong className="text-[#1a3a6e]">1.92 hectares</strong> at the heart of the municipality's commercial district. With <strong className="text-[#1a3a6e]">955 stallholders</strong> — including 727 awarded stalls, fish and meat retailers, and more — it is the center of daily commerce.</p>
                <p>Stall payment delinquency rose from <strong className="text-[#1a3a6e]">13.94% in 2023</strong> to <strong className="text-[#c0392b]">20.01% in 2024</strong>, threatening the LGU's revenue and its capacity to fund essential public services.</p>
                <p>PALENG-CLICK addresses this through accessible online payments, staggered installments, automated reminders, and comprehensive admin tools.</p>
              </motion.div>
              <motion.div variants={fadeUp} custom={2} className="pt-2">
                <Link to="/login">
                  <Button className="bg-[#1a3a6e] hover:bg-[#152f5a] text-white gap-2 px-6 rounded-lg">
                    Mag-login ngayon <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 md:py-28 bg-[#f5f7fc]">
        <div className="container mx-auto px-4 md:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14 text-center">
            <motion.span variants={fadeUp} custom={0} className="text-xs font-semibold tracking-widest uppercase text-[#c9a84c]">Mga Tampok</motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-bold text-[#0a1834] md:text-4xl" style={{ fontFamily: "Georgia, serif" }}>Para sa Pamilihang Bayan</motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 mx-auto max-w-xl text-[#4a5a7a] leading-relaxed">
              A comprehensive digital platform built specifically for San Juan's stallholders and the Municipal Treasurer's Office.
            </motion.p>
          </motion.div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i} whileHover={{ y: -4 }}
                className="group rounded-2xl border border-[#1a3a6e]/8 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#1a3a6e]/20">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a3a6e]/8 group-hover:bg-[#1a3a6e]/12 transition-colors">
                  <feature.icon className="h-5 w-5 text-[#1a3a6e]" />
                </div>
                <h3 className="mb-2 text-base font-bold text-[#0a1834]" style={{ fontFamily: "Georgia, serif" }}>{feature.title}</h3>
                <p className="text-sm text-[#6a7a9a] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0">
          <img src="/market.jpg" alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-[#0a1834]" style={{ opacity: 0.93 }} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c9a84c] via-[#e8c96a] to-[#c9a84c]" />
        <div className="container relative mx-auto px-4 md:px-8 text-center z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-5">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold text-white md:text-5xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Handa na ba kayong mag-bayad<br /><span className="text-[#e8c96a]">nang mas madali?</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="mx-auto max-w-xl text-white/70 leading-relaxed">
              Join the 955 stallholders of San Juan Public Market in embracing modern, transparent, and accessible payment management.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex justify-center gap-3 pt-2">
              <Link to="/login">
                <Button className="bg-[#e8c96a] hover:bg-[#d4b458] text-[#1a1a1a] font-semibold px-8 py-3 h-auto rounded-lg gap-2 text-base shadow-lg">
                  Mag-login <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1a3a6e]/10 bg-[#f5f7fc] py-12">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg overflow-hidden flex-shrink-0"><img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
                <div>
                  <span className="block text-sm font-bold text-[#1a3a6e]" style={{ fontFamily: "Georgia, serif" }}>PALENG-CLICK</span>
                  <span className="block text-[10px] text-[#8a9ab5] tracking-widest uppercase">San Juan, Batangas</span>
                </div>
              </div>
              <p className="text-xs text-[#6a7a9a] leading-relaxed max-w-xs">Municipal Market Fee Collection System — Office of the Municipal Treasurer, Municipality of San Juan, Province of Batangas.</p>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold tracking-widest uppercase text-[#1a3a6e]">Contact</h4>
              <div className="space-y-2">
                {[
                  { icon: MapPin, text: "San Juan, Batangas, Philippines" },
                  { icon: Phone,  text: "Municipal Treasurer's Office" },
                  { icon: Mail,   text: "public.market@sanjuan.gov.ph" },
                ].map(c => (
                  <div key={c.text} className="flex items-start gap-2 text-xs text-[#6a7a9a]">
                    <c.icon className="h-3.5 w-3.5 text-[#c9a84c] mt-0.5 shrink-0" /> {c.text}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold tracking-widest uppercase text-[#1a3a6e]">Quick Access</h4>
              <div className="space-y-2">
                {[["Vendor Portal","/login"],["Admin Portal","/login"],["Cashier Portal","/login"]].map(([l,t]) => (
                  <Link key={l} to={t} className="flex items-center gap-1.5 text-xs text-[#6a7a9a] hover:text-[#1a3a6e] transition-colors">
                    <ArrowRight className="h-3 w-3" /> {l}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-[#1a3a6e]/10 pt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
            <p className="text-xs text-[#8a9ab5]">© 2026 Municipality of San Juan, Batangas. All rights reserved.</p>
            <p className="text-xs text-[#c9a84c] font-medium tracking-wide">Naglilingkod para sa bayan</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;