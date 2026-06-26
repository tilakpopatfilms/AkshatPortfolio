/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, FormEvent } from "react";
import { User } from "firebase/auth";
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  loadFormsConfig,
  saveFormsConfig,
  parsePrefilledUrl,
  fetchFormResponses,
  GoogleFormsConfig,
  FormResponseData
} from "./lib/firebase";

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

  // Google Forms Configuration and Admin states
  const [formsConfig, setFormsConfig] = useState<GoogleFormsConfig | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ loading: boolean; success: boolean; error: string | null }>({
    loading: false,
    success: false,
    error: null
  });

  // Prefilled url parsing state
  const [pastedUrl, setPastedUrl] = useState("");
  const [parseResult, setParseResult] = useState<{ success: boolean; message: string | null }>({
    success: false,
    message: null
  });

  // Manual configurations state
  const [manualConfig, setManualConfig] = useState<Partial<GoogleFormsConfig>>({
    formId: "",
    nameEntryId: "",
    emailEntryId: "",
    subjectEntryId: "",
    messageEntryId: "",
    isEnabled: false,
    useWeb3Forms: true
  });

  // Google Forms responses viewing states
  const [responses, setResponses] = useState<FormResponseData[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "responses">("settings");

  // Load configuration on boot
  useEffect(() => {
    const fetchConfig = async () => {
      const cfg = await loadFormsConfig();
      if (cfg) {
        setFormsConfig(cfg);
        setManualConfig(cfg);
      }
    };
    fetchConfig();
  }, []);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setIsAdminLoggedIn(true);
        setAdminUser(user);
      },
      () => {
        setIsAdminLoggedIn(false);
        setAdminUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch submissions when responses tab is opened
  useEffect(() => {
    if (isAdminOpen && isAdminLoggedIn && activeTab === "responses" && formsConfig?.formId) {
      handleLoadSubmissions();
    }
  }, [isAdminOpen, isAdminLoggedIn, activeTab, formsConfig?.formId]);

  const handleLoadSubmissions = async () => {
    if (!formsConfig?.formId) {
      setResponsesError("No Google Form ID is configured.");
      return;
    }
    setLoadingResponses(true);
    setResponsesError(null);
    try {
      const fetched = await fetchFormResponses(formsConfig.formId);
      setResponses(fetched);
    } catch (err: any) {
      setResponsesError(err.message || "Failed to load submissions. Ensure your Form ID is valid and has read permissions.");
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setIsAdminLoggedIn(true);
        setAdminUser(res.user);
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleSignOut();
      setIsAdminLoggedIn(false);
      setAdminUser(null);
      setResponses([]);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const handleParseUrl = () => {
    if (!pastedUrl) {
      setParseResult({ success: false, message: "Please paste a link first." });
      return;
    }
    const result = parsePrefilledUrl(pastedUrl);
    if (result.success) {
      setManualConfig((prev) => ({
        ...prev,
        formId: result.formId,
        nameEntryId: result.autoMap.nameEntry,
        emailEntryId: result.autoMap.emailEntry,
        subjectEntryId: result.autoMap.subjectEntry,
        messageEntryId: result.autoMap.messageEntry
      }));
      setParseResult({
        success: true,
        message: "Successfully parsed! Form ID and Entry fields have been automatically mapped below."
      });
    } else {
      setParseResult({
        success: false,
        message: "Invalid link. Ensure it is a prefilled Google Forms link (containing '/viewform' and 'entry.')."
      });
    }
  };

  const handleSaveConfig = async () => {
    if (!adminUser) return;
    setSaveStatus({ loading: true, success: false, error: null });

    const newConfig: GoogleFormsConfig = {
      formId: manualConfig.formId || "",
      prefilledUrl: pastedUrl || manualConfig.prefilledUrl || "",
      nameEntryId: manualConfig.nameEntryId || "",
      emailEntryId: manualConfig.emailEntryId || "",
      subjectEntryId: manualConfig.subjectEntryId || "",
      messageEntryId: manualConfig.messageEntryId || "",
      isEnabled: !!manualConfig.isEnabled,
      useWeb3Forms: manualConfig.useWeb3Forms !== false,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.uid
    };

    if (!newConfig.formId && newConfig.isEnabled) {
      setSaveStatus({ loading: false, success: false, error: "Form ID is required to enable Google Forms integration." });
      return;
    }

    const success = await saveFormsConfig(newConfig);
    if (success) {
      setFormsConfig(newConfig);
      setSaveStatus({ loading: false, success: true, error: null });
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, success: false })), 3000);
    } else {
      setSaveStatus({
        loading: false,
        success: false,
        error: "Permission denied. Ensure your Google email is authorized to update settings."
      });
    }
  };

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

  // Escape key closer for mobile menu & admin panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isMenuOpen) setIsMenuOpen(false);
        if (isAdminOpen) setIsAdminOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen, isAdminOpen]);

  // Handle scroll overflow lock on body
  useEffect(() => {
    if (isMenuOpen || isAdminOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }
  }, [isMenuOpen, isAdminOpen]);

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

  // Unified Form submit handler (supports both Google Forms & Web3Forms)
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

    let submitSuccess = false;
    let googleSuccess = false;
    let web3Success = false;

    // 1. Google Forms submission (if enabled)
    if (formsConfig && formsConfig.isEnabled && formsConfig.formId) {
      const formUrl = `https://docs.google.com/forms/d/e/${formsConfig.formId}/formResponse`;
      const bodyParams = new URLSearchParams();
      if (formsConfig.nameEntryId) bodyParams.append(formsConfig.nameEntryId, formData.name);
      if (formsConfig.emailEntryId) bodyParams.append(formsConfig.emailEntryId, formData.email);
      if (formsConfig.subjectEntryId) bodyParams.append(formsConfig.subjectEntryId, formData.subject);
      if (formsConfig.messageEntryId) bodyParams.append(formsConfig.messageEntryId, formData.message);

      try {
        await fetch(formUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: bodyParams.toString()
        });
        googleSuccess = true;
        submitSuccess = true;
      } catch (gErr) {
        console.error("Failed to submit to Google Forms:", gErr);
      }
    }

    // 2. Web3Forms submission (if enabled or fallback)
    const runWeb3 = !formsConfig || !formsConfig.isEnabled || formsConfig.useWeb3Forms;
    if (runWeb3) {
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
          web3Success = true;
          submitSuccess = true;
        }
      } catch (err) {
        console.error("Failed to submit to Web3Forms:", err);
      }
    }

    if (submitSuccess) {
      let successMsg = "Message sent successfully!";
      if (googleSuccess && web3Success) {
        successMsg = "Message sent successfully! Registered on Google Forms and email dispatched.";
      } else if (googleSuccess) {
        successMsg = "Inquiry saved directly to Google Forms!";
      } else if (web3Success) {
        successMsg = "Message sent successfully! I will get back to you soon.";
      }

      setFormStatus({
        loading: false,
        error: null,
        success: successMsg
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } else {
      setFormStatus({
        loading: false,
        error: "Failed to send. Please check your network or try again.",
        success: null
      });
    }
  };

  // Filter form responses for search bar
  const filteredResponses = responses.filter((resp) => {
    const textToSearch = Object.entries(resp.answers)
      .map(([k, v]) => `${k} ${v}`)
      .join(" ")
      .toLowerCase();
    return textToSearch.includes(searchTerm.toLowerCase()) || resp.submittedAt.toLowerCase().includes(searchTerm.toLowerCase());
  });

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

            {/* GMAWE */}
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] md:max-w-full aspect-square flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Bottom green static layers */}
                <g className="brightened-green">
                  <path d="M 260,100 L 310,200" stroke="#96E062" strokeWidth="36" strokeLinecap="round" fill="none" strokeOpacity="1" />
                </g>

                {/* Main animated graph line */}
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

                {/* Arrow group */}
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

                {/* Top green "A" shape */}
                <g className="brightened-green">
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
          <div className="text-sm text-brand-muted font-medium flex items-center gap-4 flex-wrap justify-center md:justify-start">
            <span>2026 Akshat Popat. All rights reserved.</span>
            <span className="text-brand-border hidden sm:inline">•</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-brand-accent1 transition-colors flex items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              <i className="fas fa-lock text-xs"></i>
              <span>Admin Portal</span>
            </button>
          </div>
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

      {/* Admin Portal Modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-brand-card border border-brand-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-brand-border bg-brand-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-accent1 to-brand-accent2 flex items-center justify-center">
                  <i className="fas fa-sliders-h text-white"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Executive Control Panel</h3>
                  <p className="text-xs text-brand-muted">Configure portfolio integrations and monitor communications</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdminOpen(false)}
                className="w-10 h-10 rounded-full bg-brand-dark border border-brand-border hover:border-brand-accent1 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Main Content */}
            {!isAdminLoggedIn ? (
              /* Unauthenticated: Google Sign In */
              <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-brand-accent1/10 border border-brand-accent1/30 flex items-center justify-center mb-6">
                  <i className="fas fa-shield-alt text-2xl text-brand-accent1"></i>
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">Authorized Access Only</h4>
                <p className="text-sm text-brand-muted mb-8 leading-relaxed">
                  Authenticate with your Google Workspace credentials to manage integrations and securely inspect submissions.
                </p>

                {/* Styled Sign In Button */}
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="flex items-center gap-3 bg-white hover:bg-neutral-100 text-neutral-800 font-bold px-6 py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer text-sm font-sans"
                >
                  {isLoggingIn ? (
                    <i className="fas fa-spinner animate-spin"></i>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span>{isLoggingIn ? "Authenticating..." : "Sign in with Google"}</span>
                </button>
              </div>
            ) : (
              /* Authenticated Dashboard */
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
                {/* Admin Sidebar Navigation */}
                <div className="w-full md:w-64 bg-brand-dark/50 border-r border-brand-border p-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* User Profile */}
                    <div className="flex items-center gap-3 pb-6 border-b border-brand-border">
                      {adminUser?.photoURL ? (
                        <img src={adminUser.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border border-brand-accent1" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-accent1/20 flex items-center justify-center text-brand-accent1 font-bold">
                          {adminUser?.email?.charAt(0).toUpperCase() || "A"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{adminUser?.displayName || "Administrator"}</p>
                        <p className="text-xs text-brand-muted truncate">{adminUser?.email}</p>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setActiveTab("settings")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                          activeTab === "settings"
                            ? "bg-brand-accent1/15 text-brand-accent1 border border-brand-accent1/20"
                            : "text-brand-muted hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <i className="fas fa-cog"></i>
                        <span>Forms Settings</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("responses")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                          activeTab === "responses"
                            ? "bg-brand-accent1/15 text-brand-accent1 border border-brand-accent1/20"
                            : "text-brand-muted hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <i className="fas fa-inbox"></i>
                        <span>View Inquiries</span>
                      </button>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold border border-red-500/20 transition-all cursor-pointer"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Sign Out</span>
                  </button>
                </div>

                {/* Tab Views */}
                <div className="flex-1 overflow-y-auto p-8">
                  {/* TAB 1: Settings */}
                  {activeTab === "settings" && (
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2">Integration Configuration</h4>
                        <p className="text-sm text-brand-muted">Set up how responses from the collaboration form are processed and dispatched.</p>
                      </div>

                      {/* Toggles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Google Forms Toggle */}
                        <div className="p-5 bg-brand-dark/30 border border-brand-border rounded-2xl flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                              <i className="fab fa-google text-brand-accent1"></i>
                              <span>Google Forms API</span>
                            </p>
                            <p className="text-xs text-brand-muted mt-1">Submit inquiries to Google Form</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!manualConfig.isEnabled}
                              onChange={(e) => setManualConfig({ ...manualConfig, isEnabled: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent1"></div>
                          </label>
                        </div>

                        {/* Web3Forms Toggle */}
                        <div className="p-5 bg-brand-dark/30 border border-brand-border rounded-2xl flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                              <i className="fas fa-envelope text-brand-accent2"></i>
                              <span>Web3Forms Email</span>
                            </p>
                            <p className="text-xs text-brand-muted mt-1">Dispatch copies directly to your inbox</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={manualConfig.useWeb3Forms !== false}
                              onChange={(e) => setManualConfig({ ...manualConfig, useWeb3Forms: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent2"></div>
                          </label>
                        </div>
                      </div>

                      {/* Google Forms Auto Config Box */}
                      <div className="p-6 bg-brand-dark/40 border border-brand-accent1/20 rounded-2xl space-y-4">
                        <div>
                          <h5 className="text-sm font-bold text-white">Auto-Configuration via Prefilled Link</h5>
                          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                            To find your prefilled URL: Open your Google Form &gt; Click the 3-dots top right &gt; Select 'Get pre-filled link' &gt; Answer questions with unique tags (e.g. 'Name', 'Email', 'Subject', 'Message') &gt; Click 'Get link' and paste it here!
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            placeholder="Paste your pre-filled Google Form URL here..."
                            value={pastedUrl}
                            onChange={(e) => setPastedUrl(e.target.value)}
                            className="flex-1 bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                          />
                          <button
                            type="button"
                            onClick={handleParseUrl}
                            className="bg-brand-accent1 hover:bg-brand-accent1/90 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="fas fa-wand-magic-sparkles"></i>
                            <span>Auto-Map</span>
                          </button>
                        </div>

                        {parseResult.message && (
                          <div className={`p-3.5 rounded-xl text-xs font-medium flex items-start gap-2 ${
                            parseResult.success ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            <i className={`fas ${parseResult.success ? "fa-check-circle" : "fa-exclamation-circle"} mt-0.5`}></i>
                            <span>{parseResult.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Config Form Fields */}
                      <div className="border-t border-brand-border pt-6 space-y-4">
                        <h5 className="text-sm font-bold text-white uppercase tracking-wider">Field Parameters</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-brand-muted font-medium mb-1.5">Google Form ID</label>
                            <input
                              type="text"
                              value={manualConfig.formId || ""}
                              onChange={(e) => setManualConfig({ ...manualConfig, formId: e.target.value })}
                              placeholder="e.g. 1FAIpQLSfDxxxxxxxxxxxx"
                              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-brand-muted font-medium mb-1.5">Name Input Name (e.g. entry.XXXXXX)</label>
                            <input
                              type="text"
                              value={manualConfig.nameEntryId || ""}
                              onChange={(e) => setManualConfig({ ...manualConfig, nameEntryId: e.target.value })}
                              placeholder="entry.123456789"
                              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-brand-muted font-medium mb-1.5">Email Input Name</label>
                            <input
                              type="text"
                              value={manualConfig.emailEntryId || ""}
                              onChange={(e) => setManualConfig({ ...manualConfig, emailEntryId: e.target.value })}
                              placeholder="entry.234567890"
                              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-brand-muted font-medium mb-1.5">Subject Input Name</label>
                            <input
                              type="text"
                              value={manualConfig.subjectEntryId || ""}
                              onChange={(e) => setManualConfig({ ...manualConfig, subjectEntryId: e.target.value })}
                              placeholder="entry.345678901"
                              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-brand-muted font-medium mb-1.5">Message Input Name</label>
                            <input
                              type="text"
                              value={manualConfig.messageEntryId || ""}
                              onChange={(e) => setManualConfig({ ...manualConfig, messageEntryId: e.target.value })}
                              placeholder="entry.456789012"
                              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Save Status / Button */}
                      <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-brand-border">
                        <div>
                          {saveStatus.success && (
                            <p className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
                              <i className="fas fa-check-circle"></i>
                              <span>Configuration successfully saved to Cloud Firestore!</span>
                            </p>
                          )}
                          {saveStatus.error && (
                            <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                              <i className="fas fa-exclamation-triangle"></i>
                              <span>{saveStatus.error}</span>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveConfig}
                          disabled={saveStatus.loading}
                          className="bg-gradient-to-r from-brand-accent1 to-brand-accent2 hover:opacity-90 text-white font-bold px-6 py-3.5 rounded-xl transition-all flex items-center gap-2 justify-center cursor-pointer disabled:opacity-50"
                        >
                          {saveStatus.loading ? (
                            <i className="fas fa-spinner animate-spin"></i>
                          ) : (
                            <i className="fas fa-cloud-upload-alt"></i>
                          )}
                          <span>{saveStatus.loading ? "Saving Settings..." : "Save Settings"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Responses/Inquiries */}
                  {activeTab === "responses" && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xl font-bold text-white mb-2">Collaboration Inquiries</h4>
                          <p className="text-sm text-brand-muted">Inspect recent queries submitted through Google Forms in real time.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadSubmissions}
                          disabled={loadingResponses}
                          className="w-10 h-10 rounded-xl bg-brand-dark border border-brand-border hover:border-brand-accent1 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                          title="Reload Submissions"
                        >
                          <i className={`fas fa-sync-alt ${loadingResponses ? "animate-spin" : ""}`}></i>
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <i className="fas fa-search absolute left-4 top-3.5 text-brand-muted text-sm"></i>
                        <input
                          type="text"
                          placeholder="Search inquiries by name, email, query text..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-brand-dark border border-brand-border rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent1"
                        />
                      </div>

                      {/* Submissions List Container */}
                      <div className="space-y-4">
                        {loadingResponses ? (
                          /* Loading Spinner */
                          <div className="py-20 text-center text-brand-muted flex flex-col items-center gap-3">
                            <i className="fas fa-spinner animate-spin text-3xl text-brand-accent1"></i>
                            <span className="text-sm">Loading Google Form Submissions...</span>
                          </div>
                        ) : responsesError ? (
                          /* Error State */
                          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-lg mx-auto">
                            <i className="fas fa-exclamation-triangle text-3xl text-red-400 mb-3"></i>
                            <h5 className="text-base font-bold text-white mb-2">Connection Blocked</h5>
                            <p className="text-xs text-brand-muted leading-relaxed mb-4">
                              {responsesError}
                            </p>
                            <div className="text-left bg-brand-dark/50 p-4 rounded-xl text-xs space-y-1.5 text-brand-muted">
                              <p className="font-semibold text-white">Troubleshooting checklist:</p>
                              <p>1. Make sure Google Forms API is enabled on Google Cloud.</p>
                              <p>2. Verify your Form ID is fully valid & accessible to your user.</p>
                              <p>3. Reload this portal or complete authentication again.</p>
                            </div>
                          </div>
                        ) : filteredResponses.length === 0 ? (
                          /* Empty State */
                          <div className="p-12 border border-dashed border-brand-border rounded-2xl text-center text-brand-muted">
                            <i className="fas fa-folder-open text-3xl mb-3 text-brand-muted/50"></i>
                            <p className="text-sm font-semibold text-white">No Inquiries Found</p>
                            <p className="text-xs mt-1">
                              {searchTerm ? "No records match your current search terms." : "Your Google Form hasn't received any inquiries yet!"}
                            </p>
                          </div>
                        ) : (
                          /* Cards list */
                          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {filteredResponses.map((resp) => {
                              // Identify standard fields from mapped question titles
                              const entries = Object.entries(resp.answers) as [string, string][];
                              const nameVal = entries.find(([k]) => k.toLowerCase().includes("name"))?.[1] || "";
                              const emailVal = entries.find(([k]) => k.toLowerCase().includes("email"))?.[1] || "";
                              const subjectVal = entries.find(([k]) => k.toLowerCase().includes("subject"))?.[1] || "";
                              const messageVal = entries.find(([k]) => k.toLowerCase().includes("message"))?.[1] || "";

                              return (
                                <div key={resp.responseId} className="p-6 bg-brand-dark/30 border border-brand-border rounded-2xl space-y-4 hover:border-brand-accent1/30 transition-all">
                                  <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                      <h6 className="font-bold text-white text-base">{nameVal || "Anonymous Inquiry"}</h6>
                                      {emailVal && (
                                        <p className="text-xs text-brand-accent1 hover:underline mt-0.5">
                                          <a href={`mailto:${emailVal}`}>{emailVal}</a>
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-xs text-brand-muted font-mono">{resp.submittedAt}</span>
                                  </div>

                                  {subjectVal && (
                                    <div className="text-sm font-semibold text-white">
                                      <span className="text-brand-muted text-xs mr-1 font-normal">Subject:</span>
                                      {subjectVal}
                                    </div>
                                  )}

                                  {messageVal && (
                                    <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-line bg-brand-dark/40 p-4 rounded-xl border border-brand-border/30">
                                      {messageVal}
                                    </p>
                                  )}

                                  {/* Dynamic Questions (for any unmapped questions in their form) */}
                                  {entries.length > 0 && (
                                    <div className="pt-2 border-t border-brand-border/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {entries.map(([qTitle, qVal]) => {
                                        const lower = qTitle.toLowerCase();
                                        if (lower.includes("name") || lower.includes("email") || lower.includes("subject") || lower.includes("message")) {
                                          return null;
                                        }
                                        return (
                                          <div key={qTitle} className="text-xs bg-brand-dark/20 p-2.5 rounded-lg border border-brand-border/10">
                                            <span className="font-bold text-white block mb-0.5">{qTitle}</span>
                                            <span className="text-brand-muted">{qVal || "—"}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Actions */}
                                  {emailVal && (
                                    <div className="flex justify-end pt-2">
                                      <a
                                        href={`mailto:${emailVal}?subject=Re: ${encodeURIComponent(subjectVal || "Collaboration Inquiry")}`}
                                        className="text-xs font-bold text-brand-accent2 hover:text-white flex items-center gap-1.5 bg-brand-accent2/10 hover:bg-brand-accent2/20 px-3.5 py-2 rounded-lg border border-brand-accent2/20 transition-all"
                                      >
                                        <i className="fas fa-reply"></i>
                                        <span>Reply via Email</span>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
