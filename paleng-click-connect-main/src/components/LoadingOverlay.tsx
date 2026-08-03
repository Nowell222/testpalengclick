import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
  role?: "admin" | "vendor" | "cashier" | "bplo";
}

const LoadingOverlay = ({ message = "Processing...", role = "admin" }: LoadingOverlayProps) => {
  const isBlueTheme = role === "vendor" || role === "bplo";

  // Design based on the user's screenshot
  // Green for Admin/Cashier, Blue for Vendor/BPLO
  const circleColor = isBlueTheme ? "#2563eb" : "#065f46";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255, 255, 255, 0.8)", // Clean light overlay
      gap: 12
    }}>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: circleColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#64748b", // Muted slate color as in screenshot
          fontFamily: "inherit"
        }}
      >
        {message}
      </motion.p>
    </div>
  );
};

export default LoadingOverlay;
