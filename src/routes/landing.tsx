import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Sparkles,
  Zap,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Users,
  Send,
} from "lucide-react";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";
import { DynamicBackground } from "@/components/ui/dynamic-background";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/landing")({
  component: LandingPage,
});

const personalizationData = [
  {
    name: "Sarah Jenkins",
    company: "Helix Biotech",
    title: "VP of Sales",
    intro: "I noticed Helix Biotech is expanding its clinical trials outreach...",
  },
  {
    name: "David Miller",
    company: "Vector Logistics",
    title: "Head of Growth",
    intro: "Vector Logistics has had an incredible quarter of shipment volume...",
  },
  {
    name: "Lin Park",
    company: "Quantum SaaS",
    title: "Founder",
    intro: "I loved Quantum SaaS's latest article on automated workflows...",
  },
];

function LandingPage() {
  const [personalizeIndex, setPersonalizeIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPersonalizeIndex((prev) => (prev + 1) % personalizationData.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const activeLead = personalizationData[personalizeIndex];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background/30 text-foreground transition-colors duration-300">
      {/* Canvas Dynamic Background */}
      <DynamicBackground />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto backdrop-blur-sm bg-background/10 border-b border-border/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
            <Mail className="h-5 w-5 animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient-shine bg-clip-text text-transparent">
            Auto Mailer Pro
          </span>
        </div>
        <Link to="/login">
          <Button className="shadow-lg shadow-primary/20 hover:scale-105 hover-float transition-all duration-200">
            Sign in
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8 text-left">
          <ScaleIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur-md">
              <Sparkles
                className="h-4 w-4 text-primary animate-spin"
                style={{ animationDuration: "3s" }}
              />
              Enterprise AI Email Marketing Suite
            </div>
          </ScaleIn>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.15] text-gradient-shine bg-clip-text text-transparent">
            Scale outreach without losing the human touch.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Auto Mailer combines your client database with Groq LLM intelligence to craft customized
            cold campaigns sent securely through your SMTP server.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link to="/login">
              <Button
                size="lg"
                className="text-lg h-12 px-8 shadow-xl shadow-primary/20 hover-float transition-all duration-300"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 animate-bounce" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Live Personalization Preview Panel */}
        <div className="lg:col-span-5 relative">
          <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-3xl -z-10" />
          <FadeIn>
            <div className="glass-panel rounded-2xl border border-border/50 p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-3 right-3 flex gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
                <span className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
              </div>
              <div className="border-b border-border/40 pb-4 mb-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2">
                  Live AI Personalization Demo
                </p>
                <div className="flex gap-2 mb-2 items-center">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                    Recipient
                  </Badge>
                  <span className="text-xs font-mono text-foreground font-semibold transition-all duration-300">
                    {activeLead.name} ({activeLead.title})
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                    Company
                  </Badge>
                  <span className="text-xs font-mono text-foreground font-semibold transition-all duration-300">
                    {activeLead.company}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subject Line</Label>
                  <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-sm font-medium transition-all duration-300">
                    Quick question for {activeLead.name} @ {activeLead.company}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email Body</Label>
                  <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-xs font-mono leading-relaxed min-h-[120px] transition-all duration-300">
                    Hi {activeLead.name},<br />
                    <br />
                    <span className="text-primary font-semibold transition-all duration-300">
                      {activeLead.intro}
                    </span>
                    <br />
                    <br />I would love to connect for 5 minutes next Tuesday to share how we can
                    streamline outbound workflows. Let me know if you are free.
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Floating stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { label: "Emails Sent", value: "10M+", icon: Send },
            { label: "Active Users", value: "5K+", icon: Users },
            { label: "Response Rate", value: "45%", icon: TrendingUp },
            { label: "Time Saved", value: "80%", icon: Zap },
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 100}>
              <div className="group p-5 rounded-2xl glass-panel hover-float transition-all duration-300">
                <stat.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase mt-1">
                  {stat.label}
                </div>
              </div>
            </SlideIn>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-20">
          <ScaleIn>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Designed for Scale, Built for Delivery
            </h2>
          </ScaleIn>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything your sales team needs to execute highly personalized cold outreach campaigns
            without administrative bottlenecks.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Smart Segmentation",
              description:
                "Our AI-powered clustering analyzes uploaded CSVs, grouping leads into target cohorts automatically based on profiles.",
              color: "from-yellow-500/10 to-orange-500/10 border-yellow-500/20",
            },
            {
              icon: Sparkles,
              title: "AI Personalization Engine",
              description:
                "Generate targeted body copy, humanize the tone, and evaluate multiple subject lines based on email templates and lead data.",
              color: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
            },
            {
              icon: BarChart3,
              title: "Team-Wide Analytics",
              description:
                "Track deliveries, responses, failures, and queued workflows on a unified dashboard showing all active senders.",
              color: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
            },
            {
              icon: Shield,
              title: "Secure App Passwords",
              description:
                "Store SMTP credentials securely. Auto Mailer utilizes AES-256-CBC at-rest encryption to protect your mailboxes.",
              color: "from-green-500/10 to-emerald-500/10 border-green-500/20",
            },
            {
              icon: Mail,
              title: "Direct SMTP Integration",
              description:
                "Send outbound directly through your Google Workspace accounts, maximizing domain reputation and inbox visibility.",
              color: "from-red-500/10 to-pink-500/10 border-red-500/20",
            },
            {
              icon: CheckCircle2,
              title: "Role-Based Dashboards",
              description:
                "Separate accounts for Super Admins (platform control), Admins (lists and SMTP), and Senders (email composition).",
              color: "from-indigo-500/10 to-violet-500/10 border-indigo-500/20",
            },
          ].map((feature, i) => (
            <SlideIn key={i} delay={i * 100}>
              <div
                className={`group relative p-6 rounded-2xl border ${feature.color} glass-panel hover-float transition-all duration-300 overflow-hidden`}
              >
                <div className="relative z-10">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl glass-panel p-12 md:p-16 text-center shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
            <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Ready to transform your outreach campaigns?
              </h2>
              <p className="text-muted-foreground text-lg">
                Join high-performing marketing teams automating personalized delivery securely.
              </p>
              <div className="pt-4">
                <Link to="/login">
                  <Button
                    size="lg"
                    className="text-lg h-12 px-10 hover-float transition-all duration-300 shadow-xl shadow-primary/20"
                  >
                    Start Campaigning Now
                    <ArrowRight className="ml-2 h-5 w-5 animate-bounce" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/10 py-8 relative z-10 bg-background/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-muted-foreground">
          <p>© 2026 Auto Mailer Pro. All rights reserved. Made with love for outreach experts.</p>
        </div>
      </footer>
    </div>
  );
}
