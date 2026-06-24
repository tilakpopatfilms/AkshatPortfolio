/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, FormEvent } from "react";

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [formStatus, setFormStatus] = useState<{
    loading: boolean;
    error: string | null;
    success: string | null;
  }>({
    loading: false,
    error: null,
    success: null
  });

  const linePathRef = useRef<SVGPathElement | null>(null);
  const arrowGroupRef = useRef<SVGGElement | null>(null);
  const arrowHeadRef = useRef<SVGPathElement | null>(null);

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".section-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  // Escape key closer for mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  // Handle mobile menu overflow style on body
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }
  }, [isMenuOpen]);

  // Animated GMAWE line path and arrow calculation
  useEffect(() => {
    const linePath = linePathRef.current;
    const arrowGroup = arrowGroupRef.current;
    const arrowHead = arrowHeadRef.current;

    if (!linePath || !arrowGroup || !arrowHead) return;

    function getLastSegmentPoints(d: string) {
      const matches = d.match(/(\d+)[\s,]+(\d+)/g);
      if (!matches) return null;
      const points = matches.map((m) => {
        const [x, y] = m.split(/[\s,]+/).map(Number);
        return { x, y };
      });
      if (points.length < 2) return null;
      const tip = points[points.length - 1];
      const prev = points[points.length - 2];
      return { tip, prev };
    }

    function buildArrowPath(
      tip: { x: number; y: number },
      prev: { x: number; y: number },
      armLength = 24,
      halfAngle = 0.55
    ) {
      const dx = tip.x - prev.x;
      const dy = tip.y - prev.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return "";
      const ux = dx / len;
      const uy = dy / len;
      const bx = -ux;
      const by = -uy;
      const px = -by;
      const py = bx;
      const cosA = Math.cos(halfAngle);
      const sinA = Math.sin(halfAngle);
      const ax1 = bx * cosA - px * sinA;
      const ay1 = by * cosA - py * sinA;
      const ax2 = bx * cosA + px * sinA;
      const ay2 = by * cosA + py * sinA;
      const p1x = tip.x + ax1 * armLength;
      const p1y = tip.y + ay1 * armLength;
      const p2x = tip.x + ax2 * armLength;
      const p2y = tip.y + ay2 * armLength;
      return `M ${tip.x},${tip.y} L ${p1x},${p1y} M ${tip.x},${tip.y} L ${p2x},${p2y}`;
    }

    const dAttr = linePath.getAttribute("d");
    if (!dAttr) return;
    const seg = getLastSegmentPoints(dAttr);
    if (!seg) return;

    const tipX = seg.tip.x;
    const tipY = seg.tip.y;
    const arrowPathString = buildArrowPath(seg.tip, seg.prev, 24, 0.55);
    arrowHead.setAttribute("d", arrowPathString);

    const totalLength = linePath.getTotalLength();
    linePath.style.strokeDasharray = String(totalLength);

    const duration = 4000;
    let startTime: number | null = null;
    let animationId: number;

    function ease(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      let progress = Math.min(1, elapsed / duration);
      const eased = ease(progress);

      const offset = totalLength * (1 - eased);
      linePath.style.strokeDashoffset = String(offset);

      const point = linePath.getPointAtLength(totalLength * eased);
      const dx = point.x - tipX;
      const dy = point.y - tipY;
      arrowGroup.setAttribute("transform", `translate(${dx}, ${dy})`);

      const scaleVal = 0.15 + eased * 0.85;
      arrowHead.setAttribute("transform", `scale(${scaleVal})`);
      arrowHead.style.transformOrigin = `${tipX}px ${tipY}px`;

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          startTime = null;
          animationId = requestAnimationFrame(animate);
        }, 600);
      }
    }

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Form submit handler
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setFormStatus({
        loading: false,
        error: "Please fill in all fields.",
        success: null
      });
      return;
    }

    setFormStatus({ loading: true, error: null, success: null });

    const fd = new FormData();
    fd.append("access_key", "d826965b-d3cf-41e7-b2e4-48582c1b62d6");
    fd.append("name", formData.name);
    fd.append("email", formData.email);
    fd.append("subject", formData.subject);
    fd.append("message", formData.message);

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setFormStatus({
          loading: false,
          error: null,
          success: "Message sent successfully! I will get back to you soon."
        });
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setFormStatus({
          loading: false,
          error: "Something went wrong. Please try again.",
          success: null
        });
      }
    } catch {
      setFormStatus({
        loading: false,
        error: "Network error. Please check your connection.",
        success: null
      });
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-text font-sans selection:bg-brand-accent1 selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full z-40 bg-brand-dark/80 backdrop-blur-xl border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex-shrink-0">
              <a href="#" className="text-2xl font-bold tracking-tighter text-white group">
                AKSHAT<span className="text-brand-accent1">.</span>
              </a>
            </div>

            <div className="hidden md:flex items-center space-x-10">
              <a href="#about" className="menu-link text-brand-muted hover:text-white text-sm font-medium">
                About
              </a>
              <a href="#portfolio" className="menu-link text-brand-muted hover:text-white text-sm font-medium">
                Portfolio
              </a>
              <a href="#education" className="menu-link text-brand-muted hover:text-white text-sm font-medium">
                Education
              </a>
              <a href="#skills" className="menu-link text-brand-muted hover:text-white text-sm font-medium">
                Skills
              </a>
              <a
                href="#contact"
                className="bg-gradient-to-r from-brand-accent1 to-brand-accent2 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:shadow-lg transition-all"
              >
                Contact
              </a>
            </div>

            <div
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`hamburger md:hidden ${isMenuOpen ? "active" : ""}`}
              id="hamburgerBtn"
            >
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        id="mobileOverlay"
        onClick={() => setIsMenuOpen(false)}
        className={`mobile-menu-overlay ${isMenuOpen ? "active" : ""}`}
      ></div>

      {/* Mobile Menu Container */}
      <div id="mobileMenuContainer" className={`mobile-menu-container ${isMenuOpen ? "active" : ""}`}>
        <div id="mobileCloseBtn" onClick={() => setIsMenuOpen(false)} className="mobile-close-btn">
          <i className="fas fa-times text-white"></i>
        </div>
        <div className="flex flex-col h-full pt-24 px-8">
          <div className="space-y-6">
            <a
              href="#about"
              onClick={() => setIsMenuOpen(false)}
              className="menu-link block text-xl text-white hover:text-brand-accent1 transition-colors py-3"
            >
              About
            </a>
            <a
              href="#portfolio"
              onClick={() => setIsMenuOpen(false)}
              className="menu-link block text-xl text-white hover:text-brand-accent1 transition-colors py-3"
            >
              Portfolio
            </a>
            <a
              href="#education"
              onClick={() => setIsMenuOpen(false)}
              className="menu-link block text-xl text-white hover:text-brand-accent1 transition-colors py-3"
            >
              Education
            </a>
            <a
              href="#skills"
              onClick={() => setIsMenuOpen(false)}
              className="menu-link block text-xl text-white hover:text-brand-accent1 transition-colors py-3"
            >
              Skills
            </a>
            <a
              href="#contact"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-center bg-gradient-to-r from-brand-accent1 to-brand-accent2 text-white px-6 py-3 rounded-full text-base font-bold mt-6 hover:shadow-lg transition-all"
            >
              Contact
            </a>
          </div>
        </div>
      </div>

      {/* Home / Hero Section */}
      <section id="home" className="min-h-screen flex items-center pt-24 md:pt-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full flex flex-col-reverse md:flex-row items-center gap-12 md:gap-4 lg:gap-8">
          <div className="w-full md:w-1/2 lg:w-3/5 text-center md:text-left z-10 pb-12 md:pb-0 section-reveal">
            <h1 className="text-5xl sm:text-6xl md:text-5xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-tight">
              Future CA & <br /> <span className="text-gradient">Executive Leader.</span>
            </h1>
            <p className="text-base md:text-lg text-brand-muted mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed">
              I'm Akshat Popat. At 15, I'm mastering Commerce and scaling digital solutions as the Founder & CEO of Obsidian. Merging financial precision with technical innovation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <a
                href="#portfolio"
                className="glow-button relative w-full sm:w-auto bg-gradient-to-r from-brand-accent1 to-brand-accent2 text-white px-8 py-3.5 rounded-full font-bold hover:shadow-xl transition-all text-center"
              >
                <span>Explore Work</span>
              </a>
              <a
                href="#contact"
                className="w-full sm:w-auto bg-transparent border border-brand-border text-white px-8 py-3.5 rounded-full font-semibold hover:bg-white/5 transition-all text-center"
              >
                Connect With Me
              </a>
            </div>
          </div>

          <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center relative select-none px-4">
            <div className="absolute w-72 h-72 rounded-full bg-brand-accent1/15 blur-[90px] -z-10"></div>

            {/* GMAWE – PERFECT ATTACHMENT, NO STRAIGHT HORIZONTAL, START UNDER C */}
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] md:max-w-full aspect-square flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Bottom green static layers (fully opaque) */}
                <g className="brightened-green">
                  <path d="M 260,100 L 310,200" stroke="#96E062" strokeWidth="36" strokeLinecap="round" fill="none" strokeOpacity="1" />
                </g>

                {/* Main animated graph line – starts exactly at bottom of "C" (145,190) then natural diagonal */}
                <g className="brightened-stroke" filter="drop-shadow(0px 8px 20px rgba(79,166,232,0.5))">
                  <path
                    ref={linePathRef}
                    id="animatedLine"
                    d="M 145,190 L 160,180 L 185,205 L 215,155 L 250,200 L 335,105"
                    stroke="#4FA6E8"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    strokeOpacity="1"
                  />
                </g>

                {/* Arrow group – NO FILTER to keep color identical to line */}
                <g ref={arrowGroupRef} id="movingArrowGroup">
                  <path
                    ref={arrowHeadRef}
                    id="arrowHead"
                    stroke="#4FA6E8"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    strokeOpacity="1"
                  />
                </g>

                {/* Top green "A" shape (static, fully opaque) */}
                <g className="brightened-green">
                  {/* The "C" letter (semi-circle) – zero transparency */}
                  <path d="M 145,110 A 50,50 0 1,0 145,190" stroke="#96E062" strokeWidth="36" strokeLinecap="round" fill="none" strokeOpacity="1" />
                  <path d="M 260,100 L 210,200" stroke="#96E062" strokeWidth="36" strokeLinecap="round" fill="none" strokeOpacity="1" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-gradient-to-b from-transparent via-brand-card/20 to-transparent border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="section-reveal">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
                Bridging the Gap Between <span className="text-brand-accent1">Numbers and Code</span>
              </h2>
              <p className="text-brand-muted leading-relaxed mb-6">
                Currently navigating my 11th Commerce studies under the GSEB board, my ultimate trajectory is set toward Chartered Accountancy. I believe the future belongs to professionals who can interpret financial data and build the systems that manage it.
              </p>
              <p className="text-brand-muted leading-relaxed mb-8">
                Beyond the textbooks, I actively lead real-world business operations, conceptualize branding, and develop digital infrastructure. My approach is highly analytical, deeply creative, and consistently professional.
              </p>
              <div className="grid grid-cols-2 gap-6 border-t border-brand-border pt-8">
                <div>
                  <h4 className="text-white font-bold text-2xl mb-1">Grade 11</h4>
                  <p className="text-brand-muted text-sm">Commerce (GSEB)</p>
                </div>
                <div>
                  <h4 className="text-white font-bold text-2xl mb-1">15 Years</h4>
                  <p className="text-brand-muted text-sm">Age</p>
                </div>
              </div>
            </div>
            <div className="bg-brand-card border border-brand-border rounded-3xl p-8 relative overflow-hidden group section-reveal">
              <div className="absolute top-0 right-0 w-40 h-40 bg-brand-accent1/10 rounded-full blur-3xl group-hover:bg-brand-accent1/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-brand-accent2/10 rounded-full blur-3xl group-hover:bg-brand-accent2/20 transition-all duration-700"></div>
              <i className="fas fa-quote-left text-3xl text-brand-border mb-6"></i>
              <h3 className="text-2xl font-semibold text-white mb-4 leading-snug">
                "The modern executive doesn't just read the balance sheet; they architect the software that generates it."
              </h3>
              <p className="text-brand-accent1 font-medium">— Akshat Popat</p>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section id="portfolio" className="py-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white section-reveal">
            Executive Ventures
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3 bg-brand-card border border-brand-border rounded-2xl p-8 card-hover flex flex-col md:flex-row items-start md:items-center justify-between gap-8 section-reveal">
              <div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/30">
                  <i className="fas fa-sitemap text-brand-accent1 text-2xl"></i>
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">Obsidian</h3>
                <p className="text-brand-accent1 font-semibold text-sm tracking-wide uppercase mb-4">Founder and CEO</p>
                <p className="text-brand-muted max-w-2xl">
                  The central hub of my executive operations. Directing corporate strategy, overseeing executive governance, and managing the development of custom software solutions, digital services, and web applications.
                </p>
              </div>
              <div className="hidden md:flex flex-shrink-0">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-brand-accent1/20 to-brand-accent2/20 border-2 border-brand-border flex items-center justify-center text-brand-accent1 font-bold text-3xl">
                  AP
                </div>
              </div>
            </div>

            <div className="md:col-span-3 bg-brand-card border border-brand-border rounded-2xl p-8 card-hover section-reveal">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl flex items-center justify-center mb-4 border border-cyan-500/30">
                <i className="fas fa-compass text-brand-accent2 text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Tilak Popat Films</h3>
              <p className="text-brand-accent2 font-semibold text-sm mb-4">Producer & Technical Advisor</p>
              <p className="text-brand-muted">
                Conceptualizing visual identities for the social media agency. Strict adherence to layout aesthetics, ensuring specific design rules are executed flawlessly to maintain professional integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-24 bg-gradient-to-b from-transparent via-brand-card/20 to-transparent border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-white section-reveal">
            Professional Arsenal
          </h2>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
            <div className="flex-1 text-left section-reveal">
              <h3 className="text-sm font-bold text-brand-muted uppercase tracking-widest mb-6">
                Commerce and Financial
              </h3>
              <div className="flex flex-wrap gap-3">
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent1 hover:text-brand-accent1 hover:scale-105 transition-all cursor-default">
                  Accounting Principles
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent1 hover:text-brand-accent1 hover:scale-105 transition-all cursor-default">
                  Business Economics
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent1 hover:text-brand-accent1 hover:scale-105 transition-all cursor-default">
                  Executive Leadership
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent1 hover:text-brand-accent1 hover:scale-105 transition-all cursor-default">
                  Corporate Strategy
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent1 hover:text-brand-accent1 hover:scale-105 transition-all cursor-default">
                  Data Management
                </span>
              </div>
            </div>

            <div className="flex-1 text-left section-reveal">
              <h3 className="text-sm font-bold text-brand-muted uppercase tracking-widest mb-6">
                Technical and Creative
              </h3>
              <div className="flex flex-wrap gap-3">
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent2 hover:text-brand-accent2 hover:scale-105 transition-all cursor-default">
                  Web Development
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent2 hover:text-brand-accent2 hover:scale-105 transition-all cursor-default">
                  Software Architecture
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent2 hover:text-brand-accent2 hover:scale-105 transition-all cursor-default">
                  UI/UX Design
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent2 hover:text-brand-accent2 hover:scale-105 transition-all cursor-default">
                  Brand Identity
                </span>
                <span className="px-5 py-2.5 bg-brand-card border border-brand-border rounded-lg text-sm font-medium text-white hover:border-brand-accent2 hover:text-brand-accent2 hover:scale-105 transition-all cursor-default">
                  Video Production
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section id="education" className="py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white section-reveal">
            Academic Path
          </h2>
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-brand-card border border-brand-accent1/30 rounded-xl relative overflow-hidden group section-reveal">
              <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-brand-accent1 to-brand-accent2 group-hover:w-2 transition-all duration-300"></div>
              <div>
                <span className="text-brand-accent1 text-xs font-bold uppercase tracking-wider">Ultimate Goal</span>
                <h3 className="text-xl font-bold text-white">Chartered Accountancy (CA)</h3>
                <p className="text-brand-muted text-sm mt-1">Preparation for ICAI foundation.</p>
              </div>
              <div className="mt-4 md:mt-0">
                <span className="px-3 py-1 bg-brand-accent1/20 text-brand-accent1 text-xs font-bold rounded-full">In Focus</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-brand-dark border border-brand-border rounded-xl section-reveal">
              <div>
                <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Current</span>
                <h3 className="text-xl font-bold text-white">11th Standard (Commerce)</h3>
                <p className="text-brand-muted text-sm mt-1">GSEB Board.</p>
              </div>
              <div className="mt-4 md:mt-0">
                <span className="px-3 py-1 bg-brand-border text-white text-xs font-bold rounded-full">Ongoing</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-brand-dark border border-brand-border rounded-xl section-reveal">
              <div>
                <span className="text-brand-muted text-xs font-bold uppercase tracking-wider">Completed</span>
                <h3 className="text-xl font-bold text-white">10th Standard (SSC)</h3>
                <p className="text-brand-muted text-sm mt-1">Cleared GSEB Board with 94 Percentile</p>
              </div>
              <div className="mt-4 md:mt-0">
                <span className="text-green-500 text-sm font-semibold flex items-center gap-1">
                  <i className="fas fa-check-circle"></i> Cleared
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-gradient-to-b from-transparent via-brand-card/20 to-transparent border-t border-brand-border">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white section-reveal">
            Open to Collaboration
          </h2>
          <p className="text-brand-muted mb-10 max-w-xl mx-auto section-reveal">
            Whether you want to discuss corporate strategy, financial structuring, or a high-end web development project, my inbox is open.
          </p>

          <form onSubmit={handleFormSubmit} id="contactForm" className="space-y-4 text-left section-reveal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Name"
                className="form-input w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-3.5 text-white focus:outline-none focus:border-brand-accent1 focus:ring-1 focus:ring-brand-accent1 transition-all"
                required
              />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Your Email"
                className="form-input w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-3.5 text-white focus:outline-none focus:border-brand-accent1 focus:ring-1 focus:ring-brand-accent1 transition-all"
                required
              />
            </div>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Subject"
              className="form-input w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-3.5 text-white focus:outline-none focus:border-brand-accent1 focus:ring-1 focus:ring-brand-accent1 transition-all"
              required
            />
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={5}
              placeholder="Your Message"
              className="form-input w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-3.5 text-white focus:outline-none focus:border-brand-accent1 focus:ring-1 focus:ring-brand-accent1 transition-all resize-none"
              required
            ></textarea>

            <button
              type="submit"
              id="submitBtn"
              disabled={formStatus.loading}
              className={`glow-button relative w-full bg-gradient-to-r from-brand-accent1 to-brand-accent2 text-white font-bold py-4 rounded-lg hover:shadow-xl transition-all overflow-hidden ${
                formStatus.loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span>{formStatus.loading ? "Sending..." : "Send Message"}</span>
            </button>

            {/* Form Messages */}
            <div id="formMessage" className="text-center text-sm font-medium mt-4">
              {formStatus.success && <span className="text-green-400">{formStatus.success}</span>}
              {formStatus.error && <span className="text-red-400">{formStatus.error}</span>}
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-dark py-8 border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-brand-muted font-medium">2026 Akshat Popat. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#" className="text-brand-muted hover:text-white transition-all hover:scale-110 transform">
              <i className="fab fa-linkedin-in text-lg"></i>
            </a>
            <a href="#" className="text-brand-muted hover:text-white transition-all hover:scale-110 transform">
              <i className="fab fa-youtube text-lg"></i>
            </a>
            <a href="#" className="text-brand-muted hover:text-white transition-all hover:scale-110 transform">
              <i className="fab fa-instagram text-lg"></i>
            </a>
            <a href="#" className="text-brand-muted hover:text-white transition-all hover:scale-110 transform">
              <i className="fab fa-discord text-lg"></i>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
