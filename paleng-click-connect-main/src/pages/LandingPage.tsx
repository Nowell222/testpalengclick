import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  CreditCard,
  BarChart3,
  Bell,
  QrCode,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const stats = [
  { label: "Active Stallholders", value: "955" },
  { label: "Delinquency Rate (2024)", value: "20.01%" },
  { label: "Target Reduction", value: "50%" },
  { label: "Payment Methods", value: "4+" },
];

const features = [
  {
    icon: CreditCard,
    title: "Digital Payments",
    description: "Pay stall fees via GCash, PayMaya, Instapay, or cash — anytime, anywhere.",
  },
  {
    icon: BarChart3,
    title: "Staggered Installments",
    description: "Flexible payment plans that match your financial capacity. No more missed deadlines.",
  },
  {
    icon: Bell,
    title: "SMS Reminders",
    description: "Automated notifications for due dates, confirmations, and municipal announcements.",
  },
  {
    icon: QrCode,
    title: "QR Identification",
    description: "Unique QR codes for every stall — fast verification and payment reference.",
  },
  {
    icon: Shield,
    title: "Secure & Transparent",
    description: "HTTPS encryption, audit logs, and role-based access for complete data security.",
  },
  {
    icon: Users,
    title: "Admin Dashboard",
    description: "Real-time analytics for collections, delinquency tracking, and vendor management.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
  }),
};

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">PC</span>
            </div>
            <span className="text-lg font-bold text-foreground">PALENG-CLICK</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Impact</a>
          </div>
          <Link to="/login">
            <Button variant="hero" size="default">
              Login
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container relative mx-auto px-4">
          <motion.div
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp} custom={0} className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-civic">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              San Juan Public Market • Batangas
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="mb-6 text-4xl font-bold leading-tight text-foreground md:text-6xl">
              Your stall, digitized.
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mb-8 text-lg text-muted-foreground md:text-xl leading-relaxed">
              Manage payments, stay compliant, and grow your business at San Juan Public Market. 
              PALENG-CLICK streamlines stall fee collection through modern digital payments.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/login">
                <Button variant="hero" size="xl">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg">
                  Learn More
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Free for vendors</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Secure payments</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> SMS alerts</span>
            </motion.div>

            {/* Demo Access */}
            <motion.div variants={fadeUp} custom={5} className="mt-10">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Try the Demo</p>
              <div className="inline-flex gap-2 rounded-xl border bg-card p-2 shadow-civic">
                <Link to="/vendor">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    🏪 Vendor
                  </Button>
                </Link>
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    🛡️ Admin
                  </Button>
                </Link>
                <Link to="/cashier">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    💰 Cashier
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-y bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="text-center"
              >
                <div className="text-3xl font-bold text-foreground font-mono md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold text-foreground md:text-4xl">
              Built for the Pamilihang Bayan
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="mt-4 text-muted-foreground leading-relaxed">
              A comprehensive digital platform designed specifically for San Juan's 955 stallholders and municipal administrators.
            </motion.p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -2 }}
                className="rounded-2xl border bg-card p-6 shadow-civic transition-shadow hover:shadow-civic-lg"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold text-foreground md:text-4xl mb-6">
                Why PALENG-CLICK?
              </motion.h2>
              <motion.div variants={fadeUp} custom={1} className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  The San Juan Public Market sits on 1.92 hectares at the heart of the municipality's commercial district. With 955 stallholders — including 727 awarded stalls, 120 fish retailers, 35 meat retailers, and more — it is the center of daily commerce.
                </p>
                <p>
                  However, stall payment delinquency rose from <strong className="text-foreground">13.94% in 2023</strong> to <strong className="text-accent">20.01% in 2024</strong>, threatening the LGU's revenue and its capacity to fund essential public services.
                </p>
                <p>
                  PALENG-CLICK addresses this by offering accessible online payments, staggered installment options, automated SMS reminders, and comprehensive administrative tools — creating a more resilient, prosperous, and vibrant public market.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="text-xs font-bold text-primary-foreground">PC</span>
            </div>
            <span className="text-sm font-semibold text-foreground">PALENG-CLICK</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Municipality of San Juan, Batangas. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
