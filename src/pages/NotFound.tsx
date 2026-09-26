import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageTransition } from "@/components/PageTransition";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <PageTransition className="w-full min-h-[60vh] flex items-center justify-center flex-col gap-4">
      <h1 className="text-xl text-red-400 font-mono">{t("not_found.title", "PAGE NOT FOUND")}</h1>
      <Link to="/" className="text-gold hover:underline flex items-center gap-2">
        <ArrowLeft size={16} /> {t("not_found.back_home", "Back to Home")}
      </Link>
    </PageTransition>
  );
}
