import { useTranslation } from "@/i18n/context";
import { languages } from "@/i18n/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "compact" | "full";
}

export function LanguageSwitcher({ variant = "compact" }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();
  const current = languages.find((l) => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "full" ? (
          <Button variant="outline" size="default" className="gap-2 px-4 py-2 text-sm" data-testid="button-language-switcher">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-lg leading-none">{current?.flag}</span>
            <span>{current?.label}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" data-testid="button-language-switcher">
            <span className="text-base leading-none">{current?.flag}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? "bg-accent" : ""}
            data-testid={`button-lang-${lang.code}`}
          >
            <span className="mr-2 text-lg">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
