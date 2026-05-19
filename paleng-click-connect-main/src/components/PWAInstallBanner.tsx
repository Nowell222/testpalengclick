import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone, ArrowRight, Check, Share2, MoreVertical, Compass } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PWAInstallBannerProps {
  className?: string;
  variant?: "banner" | "floater";
}

const PWAInstallBanner = ({ 
  className = "w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-4",
  variant = "banner"
}: PWAInstallBannerProps) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [deviceOS, setDeviceOS] = useState<"ios" | "android" | "desktop">("desktop");

  // Detect OS for custom guidelines if browser-based automated trigger is unavailable
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceOS("ios");
    } else if (/android/.test(ua)) {
      setDeviceOS("android");
    } else {
      setDeviceOS("desktop");
    }
  }, []);

  // Read dismissal from localStorage after mount to prevent hydration mismatch
  useEffect(() => {
    const isDismissed = localStorage.getItem("pwa-install-banner-dismissed") === "true";
    setDismissed(isDismissed);
  }, []);

  // Show the banner automatically to promote install, even before beforeinstallprompt fires.
  // Hide only if already installed or dismissed.
  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-banner-dismissed", "true");
  };

  const handleInstall = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const success = await install();
        if (success) {
          toast.success("Thank you for installing Paleng-Click Connect!", {
            icon: <Check className="h-4 w-4 text-green-500" />,
          });
          setDismissed(true);
        } else {
          toast.error("Installation was cancelled.");
        }
      } catch (err) {
        console.error("Installation error:", err);
        setShowInstructions(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Fallback: If browser hasn't fired beforeinstallprompt or on iOS, show clean manual instructions
      setShowInstructions(true);
    }
  };

  const isFloater = variant === "floater";

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={isFloater ? { opacity: 0, scale: 0.92, y: 15 } : { opacity: 0, y: -20 }}
          animate={isFloater ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
          exit={isFloater ? { opacity: 0, scale: 0.92, y: 15 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={isFloater ? "hidden lg:block absolute top-4 right-4 sm:top-6 sm:right-6 md:right-8 z-30 max-w-[290px] w-[calc(100vw-32px)]" : className}
        >
          <div className={`relative overflow-hidden rounded-xl border border-[#c9a84c]/30 bg-[#1a2e1a] shadow-xl ${isFloater ? 'p-4' : 'p-4 sm:p-5'}`}>
            {/* Subtle gold radial background glow for premium styling */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(201,168,76,0.12)_0%,transparent_60%)] pointer-events-none" />
            
            {isFloater ? (
              // Floater Layout (Compact, floating card)
              <div className="relative z-10 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#c9a84c]/15 border border-[#c9a84c]/35 flex items-center justify-center text-[#e8c86e] shrink-0">
                      <Smartphone className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="font-serif text-[13.5px] font-bold text-[#e8c86e] leading-tight">
                      Get PALENG-CLICK App
                    </h4>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="text-[#f0e6c8]/40 hover:text-[#f0e6c8] p-1 transition-colors rounded hover:bg-[#c9a84c]/10"
                    aria-label="Dismiss app install"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <p className="font-serif text-[#f0e6c8]/70 text-[11.5px] leading-relaxed">
                  Access the portal instantly from your screen. Fast and offline-ready.
                </p>
                
                <Button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] hover:opacity-90 hover:from-[#c9a84c] hover:to-[#e8c86e] transition-opacity font-bold rounded-md py-1.5 px-3 text-[11px] tracking-wide font-serif shadow-md gap-1 flex h-8 mt-0.5"
                >
                  {isInstalling ? "Installing…" : (
                    <>
                      <Download className="w-3 h-3" />
                      Install App
                    </>
                  )}
                </Button>
              </div>
            ) : (
              // Banner Layout (Existing design)
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-start sm:items-center gap-3.5">
                  {/* Premium Icon Wrapper */}
                  <div className="w-11 h-11 rounded-lg bg-[#c9a84c]/15 border border-[#c9a84c]/35 flex items-center justify-center text-[#e8c86e] shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-serif text-[15px] sm:text-[17px] font-bold text-[#e8c86e]">
                      Download PALENG-CLICK as an App
                    </h4>
                    <p className="font-serif text-[#f0e6c8]/70 text-[12.5px] sm:text-[13.5px] mt-0.5 max-w-[620px] leading-relaxed">
                      Access the San Juan Public Market portal instantly from your computer or mobile screen with one click. Supports faster load times.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
                  <Button
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] hover:opacity-90 hover:from-[#c9a84c] hover:to-[#e8c86e] transition-opacity font-bold rounded-lg px-4 py-2 text-[12px] sm:text-[13px] tracking-wide font-serif shadow-md gap-1.5 flex h-9"
                  >
                    {isInstalling ? "Installing…" : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Install Now
                        <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                      </>
                    )}
                  </Button>

                  <button
                    onClick={handleDismiss}
                    className="text-[#f0e6c8]/40 hover:text-[#f0e6c8] p-1.5 transition-colors rounded-lg border border-transparent hover:border-[#c9a84c]/20 hover:bg-[#c9a84c]/10"
                    aria-label="Dismiss app install banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Instructional Guideline Modal Overlay */}
      <AnimatePresence>
        {showInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a1e0f]/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden w-full max-w-[380px] rounded-2xl border border-[#c9a84c]/40 bg-[#162716] p-6 text-left shadow-2xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(201,168,76,0.15)_0%,transparent_70%)] pointer-events-none" />
              
              {/* Close Button */}
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 right-4 text-[#f0e6c8]/40 hover:text-[#f0e6c8] p-1.5 transition-colors rounded-lg hover:bg-[#c9a84c]/10"
                aria-label="Close instructions modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="w-10 h-10 rounded-lg bg-[#c9a84c]/15 border border-[#c9a84c]/35 flex items-center justify-center text-[#e8c86e]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-[16px] font-bold text-[#e8c86e]">
                    Install PALENG-CLICK
                  </h3>
                  <p className="font-serif text-[#f0e6c8]/50 text-[11px]">
                    Step-by-step instructions
                  </p>
                </div>
              </div>

              {/* Responsive instructions content */}
              <div className="space-y-4 relative z-10 font-serif text-[#f0e6c8]/85 text-[13px] leading-relaxed">
                {deviceOS === "ios" ? (
                  <>
                    <p className="text-[12px] text-[#f0e6c8]/70 italic mb-2">
                      Safari on iOS does not support one-click installations. Please follow these quick steps:
                    </p>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p>
                        Tap the <strong className="text-[#e8c86e] inline-flex items-center gap-0.5">Share <Share2 className="w-3.5 h-3.5 inline mx-0.5" /></strong> button in Safari's bottom toolbar.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p>
                        Scroll down and select <strong className="text-[#e8c86e]">"Add to Home Screen" <X className="w-3 h-3 rotate-45 inline mx-0.5 bg-[#c9a84c]/30 rounded p-0.5" /></strong>.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p>
                        Tap <strong className="text-[#e8c86e]">"Add"</strong> in the top right corner. The icon will appear on your device screen!
                      </p>
                    </div>
                  </>
                ) : deviceOS === "android" ? (
                  <>
                    <p className="text-[12px] text-[#f0e6c8]/70 italic mb-2">
                      Add the portal instantly to your home screen using Chrome:
                    </p>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p>
                        Tap the browser menu button <strong className="text-[#e8c86e] inline-flex items-center gap-0.5"><MoreVertical className="w-3.5 h-3.5 inline" /> (three vertical dots)</strong> in the top right corner of Chrome.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p>
                        Select <strong className="text-[#e8c86e]">"Install App"</strong> or <strong className="text-[#e8c86e]">"Add to Home screen"</strong> from the options menu.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p>
                        Confirm by tapping <strong className="text-[#e8c86e]">"Install"</strong> when prompted. Done!
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] text-[#f0e6c8]/70 italic mb-2">
                      If your desktop browser doesn't prompt you automatically:
                    </p>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p>
                        Look at your browser's **URL address bar** at the very top of this page.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p>
                        Click the **Install** icon <strong className="text-[#e8c86e]"><Compass className="w-3.5 h-3.5 inline mx-0.5" /> (or a small [+] download symbol)</strong> located next to the bookmark star.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] font-serif font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p>
                        Confirm by clicking **"Install"** to instantly launch PALENG-CLICK as a native desktop application!
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Close Action Button */}
              <div className="mt-6 flex justify-end relative z-10">
                <Button
                  onClick={() => setShowInstructions(false)}
                  className="bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] hover:opacity-90 transition-opacity font-bold rounded-lg px-4 h-9 text-[12px] font-serif"
                >
                  Got It
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PWAInstallBanner;
