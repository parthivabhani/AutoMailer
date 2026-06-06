import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mail, Sparkles, Zap, BarChart3, Shield, ArrowRight, CheckCircle2, TrendingUp, Users, Send } from "lucide-react";
import { FadeIn, SlideIn, ScaleIn } from "@/components/ui/animated-wrapper";

export const Route = createFileRoute("/landing")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Navigation */}
      <nav className="relative flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 animate-bounce">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Auto Mailer</span>
        </div>
        <Link to="/login">
          <Button className="shadow-lg shadow-primary/25 hover:scale-105 transition-transform duration-200">
            Sign in
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-32">
        <FadeIn>
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <ScaleIn>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary animate-pulse">
                <Sparkles className="h-4 w-4" />
                AI-Powered Email Outreach Platform
              </div>
            </ScaleIn>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Transform your outreach with AI-powered email automation
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Personalized by AI, delivered from your Gmail. Scale your outreach without sacrificing quality or authenticity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/login">
                <Button size="lg" className="text-lg h-12 px-8 shadow-xl shadow-primary/25 hover:scale-105 transition-transform duration-200">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </FadeIn>

        {/* Floating stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: "Emails Sent", value: "10M+", icon: Send },
            { label: "Active Users", value: "5K+", icon: Users },
            { label: "Response Rate", value: "45%", icon: TrendingUp },
            { label: "Time Saved", value: "80%", icon: Zap },
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 100}>
              <div className="group p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                <stat.icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform duration-300" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </SlideIn>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything you need to scale outreach</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to help your team send better emails, faster.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Smart Segmentation",
              description: "AI-powered clustering automatically segments your CSVs into targeted groups for maximum impact.",
              color: "from-yellow-500/20 to-orange-500/20",
            },
            {
              icon: Sparkles,
              title: "AI Content Generation",
              description: "Generate personalized emails, humanize the tone, and test subject lines with AI assistance.",
              color: "from-purple-500/20 to-pink-500/20",
            },
            {
              icon: BarChart3,
              title: "Centralized Analytics",
              description: "Track performance across every sender in your organization with detailed analytics and reporting.",
              color: "from-blue-500/20 to-cyan-500/20",
            },
            {
              icon: Shield,
              title: "Secure & Compliant",
              description: "Enterprise-grade security with Gmail integration. Your data stays protected and compliant.",
              color: "from-green-500/20 to-emerald-500/20",
            },
            {
              icon: Mail,
              title: "Gmail Integration",
              description: "Send emails directly from your Gmail account using secure app password authentication.",
              color: "from-red-500/20 to-pink-500/20",
            },
            {
              icon: CheckCircle2,
              title: "Easy Management",
              description: "Admin controls, sender management, and CSV organization all in one intuitive dashboard.",
              color: "from-indigo-500/20 to-violet-500/20",
            },
          ].map((feature, i) => (
            <SlideIn key={i} delay={i * 100}>
              <div className="group relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-24">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground p-12 md:p-16 text-center shadow-2xl shadow-primary/25">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 animate-pulse" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">Ready to transform your outreach?</h2>
              <p className="text-lg opacity-90 max-w-2xl mx-auto">
                Join thousands of teams using Auto Mailer to send better emails, faster.
              </p>
              <Link to="/login">
                <Button size="lg" variant="secondary" className="text-lg h-12 px-8 shadow-xl hover:scale-105 transition-transform duration-200">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Auto Mailer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
