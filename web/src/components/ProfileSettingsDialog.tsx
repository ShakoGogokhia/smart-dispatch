import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type ProfileSettingsDialogProps = {
  email?: string | null;
  language?: "en" | "ka";
  name?: string | null;
  onLogout?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "Could not save profile settings.";
  }

  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return "Could not save profile settings.";
  }

  const data = response.data;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }

  return "Could not save profile settings.";
}

export default function ProfileSettingsDialog({
  email,
  language = "en",
  name,
  onLogout,
  onOpenChange,
  open,
}: ProfileSettingsDialogProps) {
  const queryClient = useQueryClient();
  const { setLanguage } = useI18n();
  const [formName, setFormName] = useState(name ?? "");
  const [formLanguage, setFormLanguage] = useState<"en" | "ka">(language);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormName(name ?? "");
    setFormLanguage(language);
    setError(null);
    setSaved(false);
  }, [language, name, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await api.patch("/api/me", {
        name: formName.trim(),
        language: formLanguage,
      });
      setLanguage(formLanguage);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    auth.clear();
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    onOpenChange(false);
    onLogout?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-auto max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto p-0">
        <div className="grid gap-6 p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Profile settings</DialogTitle>
            <DialogDescription>
              Update the name shown in the header and keep your language preference synced.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="field-group">
              <Label className="field-label" htmlFor="profile-name">
                Display name
              </Label>
              <Input
                id="profile-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="input-shell"
                placeholder="Your name"
              />
            </div>

            <div className="field-group">
              <Label className="field-label" htmlFor="profile-email">
                Email
              </Label>
              <Input id="profile-email" value={email ?? ""} className="input-shell" disabled readOnly />
            </div>

            <div className="field-group">
              <Label className="field-label">Language</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={formLanguage === "en" ? "default" : "secondary"}
                  className="h-11 rounded-[16px]"
                  onClick={() => setFormLanguage("en")}
                >
                  English
                </Button>
                <Button
                  type="button"
                  variant={formLanguage === "ka" ? "default" : "secondary"}
                  className="h-11 rounded-[16px]"
                  onClick={() => setFormLanguage("ka")}
                >
                  Georgian
                </Button>
              </div>
            </div>

            {error && <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            {saved && <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Profile updated.</div>}

            <DialogFooter className="mt-2 justify-between sm:justify-between">
              <Button type="button" variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
              <Button type="submit" disabled={saving || !formName.trim()}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
