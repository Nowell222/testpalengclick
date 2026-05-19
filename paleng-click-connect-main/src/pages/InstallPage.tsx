import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, ArrowLeft, Smartphone, Share2, MoreVertical, Compass, Monitor, Check, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const InstallPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [deviceOS, setDeviceOS] = useState<"ios" | "android" | "desktop">("desktop");

  // Detect OS for custom guidelines
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

  const handleInstall = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const success = await install();
        if (success) {
          toast.success("Thank you for installing Paleng-Click Connect!", {
            icon: <Check className="h-4 w-4 text-green-500" />,
          });
        } else {
          toast.error("Installation was cancelled.");
        }
      } catch (err) {
        console.error("Installation error:", err);
        toast.error("An error occurred during install. Please follow the instructions below.");
      } finally {
        setIsInstalling(false);
      }
    } else {
      toast.info("Native installation is not supported by your browser. Please follow the manual steps below.");
    }
  };

  const handleBack = () => {
    if (user) {
      if (user.user_metadata?.role === "admin") {
        navigate("/admin");
      } else if (user.user_metadata?.role === "cashier") {
        navigate("/cashier");
      } else {
        navigate("/vendor");
      }
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1e12] text-[#f0e6c8] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-serif">
      {/* Premium background radial gradient and subtle gold glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(201,168,76,0.15)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent" />
      
      {/* Main Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[500px] bg-[#162716] border border-[#c9a84c]/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(201,168,76,0.05)_0%,transparent_50%)] pointer-events-none" />

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[#f0e6c8]/60 hover:text-[#e8c86e] transition-colors text-[13px] mb-6 font-serif"
        >
          <ArrowLeft className="w-4 h-4" />
          {user ? "Back to Portal" : "Back to Login"}
        </button>

        {/* Header App Representation */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a3a1a] to-[#0d1e12] border border-[#c9a84c]/40 flex items-center justify-center shadow-xl mb-4 relative group">
            <img src="/favicon.png" alt="Paleng-Click Logo" className="w-14 h-14 object-contain group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-2xl border border-[#e8c86e]/20 pointer-events-none" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e8c86e] tracking-tight">
            PALENG-CLICK
          </h1>
          <p className="text-[11px] sm:text-[12px] text-[#f0e6c8]/40 uppercase tracking-[0.2em] mt-1">
            San Juan Market Portal
          </p>
          
          <p className="text-[13px] sm:text-[14px] text-[#f0e6c8]/70 mt-3 max-w-[360px] leading-relaxed">
            Install the application on your computer or mobile screen for offline support, instant desktop launch, and faster page loads.
          </p>
        </div>

        {/* Dynamic Action Area */}
        <div className="space-y-6">
          {/* Status Badge */}
          {isInstalled ? (
            <div className="flex items-center justify-center gap-2 bg-[#1b3d1b] border border-[#c9a84c]/20 rounded-xl p-4 text-[#e8c86e] text-[13.5px] font-bold">
              <Check className="w-5 h-5 text-green-500" />
              App is Installed Successfully!
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="w-full bg-gradient-to-br from-[#c9a84c] to-[#e8c86e] text-[#1a2e1a] hover:opacity-90 hover:from-[#c9a84c] hover:to-[#e8c86e] transition-opacity font-bold rounded-xl py-6 px-4 text-[14px] tracking-wide font-serif shadow-lg gap-2 flex"
              >
                {isInstalling ? (
                  "Installing application..."
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install Paleng-Click App
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-[#f0e6c8]/40">
                Click above to prompt your browser's automated setup.
              </p>
            </div>
          ) : (
            <div className="bg-[#1b3d1b]/20 border border-[#c9a84c]/20 rounded-xl p-4 text-center">
              <span className="text-[12px] text-[#f0e6c8]/50 italic block">
                Native one-click install not ready or not supported by this browser.
              </span>
              <span className="text-[12px] text-[#e8c86e] font-bold mt-1 block">
                Please follow the manual steps below to add it in seconds!
              </span>
            </div>
          )}

          {/* Detailed Step-by-Step Manual Guide */}
          <div className="border-t border-[#c9a84c]/15 pt-6">
            <h3 className="text-[14px] font-bold text-[#e8c86e] mb-4 flex items-center gap-2">
              {deviceOS === "ios" ? (
                <><Smartphone className="w-4 h-4" /> Safari on iOS Guide</>
              ) : deviceOS === "android" ? (
                <><Smartphone className="w-4 h-4" /> Android Chrome Guide</>
              ) : (
                <><Monitor className="w-4 h-4" /> Desktop Browser Guide</>
              )}
            </h3>

            <div className="space-y-4 text-[13px] text-[#f0e6c8]/85 leading-relaxed">
              {deviceOS === "ios" ? (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">1</div>
                    <p>
                      Tap the <strong className="text-[#e8c86e] inline-flex items-center gap-0.5">Share <Share2 className="w-3.5 h-3.5 inline mx-0.5" /></strong> button in Safari's bottom toolbar.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">2</div>
                    <p>
                      Scroll down and select <strong className="text-[#e8c86e]">"Add to Home Screen" <X className="w-3 h-3 rotate-45 inline mx-0.5 bg-[#c9a84c]/30 rounded p-0.5" /></strong>.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">3</div>
                    <p>
                      Tap <strong className="text-[#e8c86e]">"Add"</strong> in the top-right corner. The icon will appear on your device screen!
                    </p>
                  </div>
                </>
              ) : deviceOS === "android" ? (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">1</div>
                    <p>
                      Tap the browser menu button <strong className="text-[#e8c86e] inline-flex items-center gap-0.5"><MoreVertical className="w-3.5 h-3.5 inline" /></strong> (three vertical dots) in the top-right corner.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">2</div>
                    <p>
                      Select <strong className="text-[#e8c86e]">"Install App"</strong> or <strong className="text-[#e8c86e]">"Add to Home screen"</strong> from the options.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">3</div>
                    <p>
                      Confirm by tapping <strong className="text-[#e8c86e]">"Install"</strong> when prompted.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">1</div>
                    <p>
                      Look at your browser's **URL address bar** at the very top of this window.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">2</div>
                    <p>
                      Click the **Install** icon <strong className="text-[#e8c86e]"><Compass className="w-3.5 h-3.5 inline mx-0.5" /> (or a small [+] download symbol)</strong> located next to the bookmark star.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#e8c86e] text-[10.5px] flex items-center justify-center shrink-0 mt-0.5 font-bold">3</div>
                    <p>
                      Confirm by clicking **"Install"** to instantly launch the portal in desktop application mode!
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom OS Toggles to switch guide manually */}
        <div className="border-t border-[#c9a84c]/15 mt-6 pt-4 flex items-center justify-center gap-3 text-[11px] text-[#f0e6c8]/50">
          <span>Show instructions for:</span>
          <button onClick={() => setDeviceOS("desktop")} className={`px-2 py-1 rounded transition-colors ${deviceOS === "desktop" ? "bg-[#c9a84c]/20 text-[#e8c86e] font-bold" : "hover:text-[#f0e6c8]"}`}>
            Desktop
          </button>
          <button onClick={() => setDeviceOS("android")} className={`px-2 py-1 rounded transition-colors ${deviceOS === "android" ? "bg-[#c9a84c]/20 text-[#e8c86e] font-bold" : "hover:text-[#f0e6c8]"}`}>
            Android
          </button>
          <button onClick={() => setDeviceOS("ios")} className={`px-2 py-1 rounded transition-colors ${deviceOS === "ios" ? "bg-[#c9a84c]/20 text-[#e8c86e] font-bold" : "hover:text-[#f0e6c8]"}`}>
            iOS
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default InstallPage;
