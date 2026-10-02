import { motion } from "motion/react";
import { Smartphone } from "lucide-react";

// A persistent-iframe phone-frame preview + scannable QR code for a project that's actually live and usable,
// not just screenshots. The iframe is the real deployed app running inside the device bezel -- visitors on
// desktop can click around right here, and the QR code hands the same URL to their own phone where it can be
// added to the home screen like any other app (see public/atelierfit-manifest.webmanifest).
export function MobilePreviewBlock({ url, appName }: { url: string; appName: string }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=212-175-55&bgcolor=11-10-8&data=${encodeURIComponent(url)}`;

  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.45 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase border-b border-white/5 pb-2 flex items-center gap-2">
        <Smartphone size={20} className="text-gold" />
        <span>Live Preview</span>
      </h2>
      <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {/* Phone bezel around a real, interactive iframe of the deployed app */}
        <div className="relative shrink-0 w-[220px] h-[460px] rounded-[2.5rem] border-[8px] border-[#1c1c1c] bg-black shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#1c1c1c] rounded-b-xl z-10" />
          <iframe
            src={url}
            title={`${appName} live preview`}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>

        <div className="flex flex-col items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="bg-white rounded-xl p-3">
            <img src={qrSrc} alt={`QR code linking to ${appName}`} width={160} height={160} className="block" />
          </div>
          <div className="max-w-xs">
            <p className="text-white font-medium mb-1">Scan to try it on your own phone</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Opens straight in your mobile browser -- no app-store install needed. Once it's open, use your
              browser's "Add to Home Screen" option and it behaves like any other installed app from then on.
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
