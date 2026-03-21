import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useRef } from "react";
import {
  CreditCard, BarChart3, Bell, QrCode, Shield, Users,
  ArrowRight, CheckCircle2, MapPin, Phone, Mail,
} from "lucide-react";

const stats = [
  { label: "Active Stallholders", value: "955", suffix: "" },
  { label: "Delinquency Rate 2024", value: "20.01", suffix: "%" },
  { label: "Target Reduction", value: "50", suffix: "%" },
  { label: "Payment Methods", value: "4", suffix: "+" },
];

const features = [
  { icon: CreditCard, title: "Digital Payments",       description: "Pay stall fees via GCash, PayMaya, Instapay, or cash — anytime, anywhere." },
  { icon: BarChart3,  title: "Staggered Installments", description: "Flexible payment plans that match your financial capacity. No more missed deadlines." },
  { icon: Bell,       title: "SMS Reminders",          description: "Automated notifications for due dates, confirmations, and municipal announcements." },
  { icon: QrCode,     title: "QR Identification",      description: "Unique QR codes for every stall — fast verification and payment reference." },
  { icon: Shield,     title: "Secure & Transparent",   description: "HTTPS encryption, audit logs, and role-based access for complete data security." },
  { icon: Users,      title: "Admin Dashboard",        description: "Real-time analytics for collections, delinquency tracking, and vendor management." },
];

const fadeUp = {
  hidden:   { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

const LandingPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY       = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#f8f5f0" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{ background: "rgba(248,245,240,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #d4c9b8", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            {/* favicon.png logo */}
            <div style={{ width: 42, height: 42, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(26,74,46,0.3)", flexShrink: 0 }}>
              <img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2e1a", letterSpacing: 1, fontFamily: "'Georgia', serif" }}>PALENG-CLICK</div>
              <div style={{ fontSize: 10, color: "#6b7c6b", letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ display: "flex", gap: 28 }} className="hidden md:flex">
              {["Features","About","Impact"].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} style={{ fontSize: 13, color: "#4a5e4a", textDecoration: "none", letterSpacing: 0.5, fontFamily: "Georgia, serif" }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = "#1a4a2e"}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = "#4a5e4a"}>
                  {item}
                </a>
              ))}
            </div>
            <Link to="/login">
              <button style={{ background: "linear-gradient(135deg, #1a4a2e, #2d7a4f)", color: "#f0e6c8", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8, fontFamily: "Georgia, serif" }}>
                Login <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ position: "relative", minHeight: "92vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <motion.div style={{ position: "absolute", inset: 0, y: heroY }}>
          <img src="/market.jpg" alt="San Juan Public Market" style={{ width: "100%", height: "115%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,30,15,0.88) 0%, rgba(10,30,15,0.65) 50%, rgba(10,30,15,0.4) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,30,15,0.6) 0%, transparent 60%)" }} />
        </motion.div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #c9a84c, #e8c86e, #c9a84c, transparent)" }} />

        <motion.div style={{ opacity: heroOpacity, position: "relative", zIndex: 2, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={0} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 100, padding: "8px 20px", marginBottom: 28 }}>
              <MapPin size={13} color="#c9a84c" />
              <span style={{ color: "#e8c86e", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Georgia, serif" }}>Pamilihang Bayan ng San Juan, Batangas</span>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} style={{ color: "#f0e6c8", fontSize: "clamp(2.4rem, 6vw, 4.5rem)", fontWeight: 700, lineHeight: 1.08, fontFamily: "Georgia, serif", maxWidth: 780, marginBottom: 8 }}>
              Your Stall,{" "}<span style={{ color: "#e8c86e", fontStyle: "italic" }}>Dignified.</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} style={{ color: "rgba(201,168,76,0.8)", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24, fontFamily: "Georgia, serif" }}>
              Para sa mga Magtitinda ng San Juan
            </motion.p>
            <motion.p variants={fadeUp} custom={3} style={{ color: "rgba(240,230,200,0.82)", fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.75, maxWidth: 580, marginBottom: 44, fontFamily: "Georgia, serif" }}>
              A modern digital platform that empowers San Juan's 955 stallholders — streamlining stall fee payments through secure, accessible, and transparent technology.
            </motion.p>
            <motion.div variants={fadeUp} custom={4} style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 52 }}>
              <Link to="/login">
                <button style={{ background: "linear-gradient(135deg, #c9a84c, #e8c86e)", color: "#1a2e1a", border: "none", borderRadius: 6, padding: "14px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8, fontFamily: "Georgia, serif", boxShadow: "0 4px 20px rgba(201,168,76,0.35)" }}>
                  Get Started <ArrowRight size={16} />
                </button>
              </Link>
              <a href="#features">
                <button style={{ background: "transparent", color: "#f0e6c8", border: "1px solid rgba(240,230,200,0.35)", borderRadius: 6, padding: "14px 32px", fontSize: 14, cursor: "pointer", letterSpacing: 0.5, fontFamily: "Georgia, serif" }}>
                  Learn More
                </button>
              </a>
            </motion.div>
            <motion.div variants={fadeUp} custom={5} style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {["Free for vendors","Secure payments","SMS alerts","LGU-powered"].map(t => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(232,200,110,0.9)", fontSize: 12, fontFamily: "Georgia, serif" }}>
                  <CheckCircle2 size={13} color="#c9a84c" /> {t}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, transparent, #f8f5f0)" }} />
      </section>

      {/* ── STATS BAND ──────────────────────────────────────────────────────── */}
      <section id="impact" style={{ background: "#1a2e1a", padding: "60px 24px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ color: "#c9a84c", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 8 }}>By the Numbers</p>
            <h2 style={{ color: "#f0e6c8", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontFamily: "Georgia, serif", fontWeight: 700 }}>The Challenge We're Solving</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                style={{ textAlign: "center", padding: "36px 24px", borderRight: i < stats.length - 1 ? "1px solid rgba(201,168,76,0.2)" : "none" }}>
                <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: "clamp(2.4rem, 4vw, 3.2rem)", color: "#e8c86e", lineHeight: 1 }}>
                  {stat.value}<span style={{ fontSize: "0.55em", color: "#c9a84c" }}>{stat.suffix}</span>
                </div>
                <div style={{ color: "rgba(240,230,200,0.65)", fontSize: 12, marginTop: 10, letterSpacing: 0.5, fontFamily: "Georgia, serif" }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />
      </section>

      {/* ── MUNICIPAL HALL SECTION ───────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 520 }} className="flex flex-col lg:grid">
          <div style={{ position: "relative", minHeight: 320, overflow: "hidden" }}>
            <img src="/hall.jpg" alt="Municipal Hall of San Juan Batangas" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #f8f5f0)" }} />
            <div style={{ position: "absolute", inset: 16, border: "1px solid rgba(201,168,76,0.3)", pointerEvents: "none" }} />
          </div>
          <div style={{ background: "#f8f5f0", padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.p variants={fadeUp} custom={0} style={{ color: "#c9a84c", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 16 }}>Municipality of San Juan</motion.p>
              <motion.h2 variants={fadeUp} custom={1} style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem, 3vw, 2.6rem)", fontWeight: 700, color: "#1a2e1a", lineHeight: 1.2, marginBottom: 24 }}>
                Serving the Heart of<br /><em style={{ color: "#2d7a4f" }}>Batangas Commerce</em>
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} style={{ color: "#5a6e5a", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia, serif", marginBottom: 20 }}>
                The San Juan Public Market sits on 1.92 hectares at the heart of the municipality's commercial district — home to 955 stallholders including awarded stalls, fish retailers, meat retailers, and dry goods vendors.
              </motion.p>
              <motion.p variants={fadeUp} custom={3} style={{ color: "#5a6e5a", fontSize: 15, lineHeight: 1.8, fontFamily: "Georgia, serif", marginBottom: 32 }}>
                PALENG-CLICK bridges modern technology with the municipality's commitment to transparent, efficient governance for every stallholder.
              </motion.p>
              <motion.div variants={fadeUp} custom={4} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["LGU San Juan", "1.92 hectares", "955 Stallholders", "Since 2026"].map(tag => (
                  <span key={tag} style={{ background: "rgba(45,122,79,0.08)", border: "1px solid rgba(45,122,79,0.2)", color: "#2d7a4f", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontFamily: "Georgia, serif" }}>{tag}</span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: "#1a2e1a", padding: "96px 24px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(45,122,79,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(201,168,76,0.08) 0%, transparent 50%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 64 }}>
            <motion.p variants={fadeUp} custom={0} style={{ color: "#c9a84c", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 12 }}>Platform Features</motion.p>
            <motion.h2 variants={fadeUp} custom={1} style={{ color: "#f0e6c8", fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 700, marginBottom: 16 }}>Built for the Pamilihang Bayan</motion.h2>
            <motion.p variants={fadeUp} custom={2} style={{ color: "rgba(240,230,200,0.6)", fontSize: 15, fontFamily: "Georgia, serif", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
              A comprehensive platform designed specifically for San Juan's stallholders and municipal administrators.
            </motion.p>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 1, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, overflow: "hidden" }}>
            {features.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                style={{ padding: "36px 32px", borderRight: "1px solid rgba(201,168,76,0.15)", borderBottom: "1px solid rgba(201,168,76,0.15)", transition: "background 0.3s", cursor: "default" }}
                whileHover={{ backgroundColor: "rgba(45,122,79,0.08)" }}>
                <div style={{ width: 44, height: 44, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <f.icon size={20} color="#c9a84c" />
                </div>
                <h3 style={{ color: "#f0e6c8", fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ color: "rgba(240,230,200,0.55)", fontSize: 13.5, lineHeight: 1.75, fontFamily: "Georgia, serif" }}>{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT / WHY ───────────────────────────────────────────────────────── */}
      <section id="about" style={{ background: "#f8f5f0", padding: "96px 24px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 1, height: 80, background: "linear-gradient(to bottom, #1a2e1a, transparent)" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.p variants={fadeUp} custom={0} style={{ color: "#c9a84c", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 16 }}>Our Mission</motion.p>
            <motion.h2 variants={fadeUp} custom={1} style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 700, color: "#1a2e1a", marginBottom: 32, lineHeight: 1.2 }}>Why PALENG-CLICK?</motion.h2>
            <motion.div variants={fadeUp} custom={2} style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40, flexWrap: "wrap" }}>
              {[["13.94%","Delinquency 2023"],["20.01%","Delinquency 2024"],["50%","Reduction Target"]].map(([val, lbl]) => (
                <div key={lbl} style={{ background: "#fff", border: "1px solid #ddd5c5", borderRadius: 10, padding: "20px 28px", textAlign: "center", minWidth: 140 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "1.8rem", fontWeight: 700, color: val === "50%" ? "#2d7a4f" : "#b34a2a", lineHeight: 1 }}>{val}</div>
                  <div style={{ color: "#7a8a7a", fontSize: 11, marginTop: 6, fontFamily: "Georgia, serif", letterSpacing: 0.5 }}>{lbl}</div>
                </div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} custom={3} style={{ color: "#5a6e5a", fontSize: 15.5, lineHeight: 1.85, fontFamily: "Georgia, serif", textAlign: "left", background: "#fff", border: "1px solid #ddd5c5", borderRadius: 12, padding: "36px 40px" }}>
              <p style={{ marginBottom: 16 }}>
                The San Juan Public Market is the center of daily commerce for the municipality — a vibrant hub serving hundreds of families who depend on it for their livelihood and daily needs.
              </p>
              <p style={{ marginBottom: 16 }}>
                However, stall payment delinquency rose from <strong style={{ color: "#1a2e1a" }}>13.94% in 2023</strong> to <strong style={{ color: "#b34a2a" }}>20.01% in 2024</strong>, threatening the LGU's revenue and its capacity to fund essential public services for all citizens of San Juan.
              </p>
              <p>
                PALENG-CLICK addresses this by offering accessible online payments, staggered installment options, automated reminders, and comprehensive administrative tools — creating a more resilient and transparent public market.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", minHeight: 380, display: "flex", alignItems: "center" }}>
          <img src="/market.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,25,12,0.88)" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />
          <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "64px 24px", textAlign: "center", width: "100%" }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.p variants={fadeUp} custom={0} style={{ color: "#c9a84c", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 16 }}>Ready to Get Started?</motion.p>
              <motion.h2 variants={fadeUp} custom={1} style={{ color: "#f0e6c8", fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 700, marginBottom: 20, lineHeight: 1.2 }}>Join San Juan's Digital Market</motion.h2>
              <motion.p variants={fadeUp} custom={2} style={{ color: "rgba(240,230,200,0.7)", fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 36, maxWidth: 500, margin: "0 auto 36px" }}>
                Stallholders and municipal staff — log in to start managing payments the modern way.
              </motion.p>
              <motion.div variants={fadeUp} custom={3}>
                <Link to="/login">
                  <button style={{ background: "linear-gradient(135deg, #c9a84c, #e8c86e)", color: "#1a2e1a", border: "none", borderRadius: 6, padding: "16px 40px", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "Georgia, serif", boxShadow: "0 4px 24px rgba(201,168,76,0.4)" }}>
                    Login to PALENG-CLICK <ArrowRight size={16} />
                  </button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0f1e0f", padding: "48px 24px 32px", borderTop: "1px solid rgba(201,168,76,0.2)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                {/* favicon.png footer logo */}
                <div style={{ width: 36, height: 36, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
                  <img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <span style={{ color: "#f0e6c8", fontWeight: 700, fontFamily: "Georgia, serif", fontSize: 15 }}>PALENG-CLICK</span>
              </div>
              <p style={{ color: "rgba(240,230,200,0.5)", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.7 }}>
                Digital payment system for San Juan Public Market stallholders.
              </p>
            </div>
            {/* Contact */}
            <div>
              <h4 style={{ color: "#c9a84c", fontFamily: "Georgia, serif", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Contact</h4>
              {[
                { icon: MapPin, text: "San Juan Public Market, San Juan, Batangas" },
                { icon: Phone, text: "Municipal Treasurer's Office" },
                { icon: Mail,  text: "Municipality of San Juan, Batangas" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                  <Icon size={13} color="#c9a84c" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ color: "rgba(240,230,200,0.55)", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{text}</span>
                </div>
              ))}
            </div>
            {/* Quick links */}
            <div>
              <h4 style={{ color: "#c9a84c", fontFamily: "Georgia, serif", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Quick Links</h4>
              {[["Login","login"],["Features","#features"],["About","#about"]].map(([label, href]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  {href.startsWith("#")
                    ? <a href={href} style={{ color: "rgba(240,230,200,0.55)", fontSize: 13, fontFamily: "Georgia, serif", textDecoration: "none" }}>{label}</a>
                    : <Link to={`/${href}`} style={{ color: "rgba(240,230,200,0.55)", fontSize: 13, fontFamily: "Georgia, serif", textDecoration: "none" }}>{label}</Link>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(201,168,76,0.15)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ color: "rgba(240,230,200,0.35)", fontSize: 12, fontFamily: "Georgia, serif" }}>© 2026 Municipality of San Juan, Batangas. All rights reserved.</p>
            <p style={{ color: "rgba(240,230,200,0.25)", fontSize: 11, fontFamily: "Georgia, serif", letterSpacing: 1 }}>PALENG-CLICK SYSTEM · LGU SAN JUAN</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;