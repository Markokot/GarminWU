import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Loader2, Send, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n/context";

export function BugReportDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await apiRequest("POST", "/api/bug-reports", {
        message: message.trim(),
        page: window.location.pathname,
      });
      setSent(true);
      toast({ title: t("bugReport.thankYou"), description: t("bugReport.sentToDevDesc") });
      setTimeout(() => {
        setOpen(false);
        setMessage("");
        setSent(false);
      }, 1500);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setMessage(""); setSent(false); } }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-bug-report"
        >
          <Bug className="w-4 h-4" />
          <span>{t("nav.reportBug")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bugReport.title")}</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="text-sm text-muted-foreground">{t("bugReport.sent")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("bugReport.description")}
            </p>
            <Textarea
              placeholder={t("bugReport.placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              data-testid="input-bug-message"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{message.length}/2000</span>
              <Button
                onClick={handleSubmit}
                disabled={sending || !message.trim()}
                data-testid="button-send-bug-report"
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {t("common.send")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
