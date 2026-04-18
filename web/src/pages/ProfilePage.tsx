import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Could not save profile.";
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? "Could not save profile.";
}

export default function ProfilePage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!meQ.data) {
      return;
    }

    setName(meQ.data.name ?? "");
    setPhone(meQ.data.phone ?? "");
    setAddress(meQ.data.address ?? "");
  }, [meQ.data]);

  const saveProfileM = useMutation({
    mutationFn: async () =>
      (
        await api.patch("/api/me", {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          current_password: currentPassword || undefined,
          password: newPassword || undefined,
          password_confirmation: confirmPassword || undefined,
        })
      ).data,
    onSuccess: async () => {
      setSuccessMessage("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Profile settings</h1>
        <p className="theme-copy mt-2 text-sm leading-6">
          Update your saved customer details here so checkout can autofill them automatically.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[30px]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Profile details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl" />
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={meQ.data?.email ?? ""} readOnly className="rounded-2xl bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-2xl" placeholder="Optional phone number" />
              </div>

              <div className="grid gap-2">
                <Label>Address</Label>
                <Input value={address} onChange={(event) => setAddress(event.target.value)} className="rounded-2xl" placeholder="Optional saved address" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Password</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Current password</Label>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-2xl" />
            </div>

            <div className="grid gap-2">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-2xl" />
            </div>

            <div className="grid gap-2">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-2xl" />
            </div>

            <div className="theme-copy text-sm leading-6">
              Leave the password fields empty if you only want to update your saved contact details.
            </div>
          </CardContent>
        </Card>
      </div>

      {saveProfileM.error ? (
        <div className="status-bad rounded-[20px] border px-4 py-3 text-sm">
          {getErrorMessage(saveProfileM.error)}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => saveProfileM.mutate()} disabled={saveProfileM.isPending || name.trim().length < 2}>
          {saveProfileM.isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
