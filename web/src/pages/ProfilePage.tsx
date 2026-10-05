import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, KeyRound, Upload, UserRound } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { resolveApiMediaUrl } from "@/lib/media";
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
      toast.success("Profile updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const uploadPhotoM = useMutation({
    mutationFn: async () => {
      if (!photoFile) {
        return null;
      }

      const formData = new FormData();
      formData.append("photo", photoFile);
      return (await api.post("/api/me/photo", formData)).data;
    },
    onSuccess: async () => {
      setSuccessMessage("Profile photo updated.");
      toast.success("Profile photo updated");
      setPhotoFile(null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const profilePhotoUrl = resolveApiMediaUrl(meQ.data?.profile_photo_url);
  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const initials =
    (meQ.data?.name ?? "User")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join("") || "U";

  const passwordTouched = Boolean(currentPassword || newPassword || confirmPassword);
  const passwordMismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);
  const canSave = !saveProfileM.isPending && name.trim().length >= 2;

  const saveButton = (label: string) => (
    <Button onClick={() => saveProfileM.mutate()} disabled={!canSave}>
      {saveProfileM.isPending ? <Spinner /> : null}
      {saveProfileM.isPending ? "Saving..." : label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile settings"
        description="Update your saved details so checkout can fill them in automatically."
        breadcrumbs={[{ label: "Account" }, { label: "Profile" }]}
      />

      {successMessage ? (
        <Alert>
          <Check />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {meQ.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-6">
            {/* Photo */}
            <Card>
              <CardHeader>
                <CardTitle>Profile picture</CardTitle>
                <CardDescription>Shown to markets and drivers on your orders.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="size-20 text-xl">
                    {previewUrl || profilePhotoUrl ? (
                      <AvatarImage src={previewUrl ?? profilePhotoUrl ?? undefined} alt={meQ.data?.name ?? "Profile"} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Label htmlFor="profile-photo">Choose an image</Label>
                    <Input id="profile-photo" type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
                    <p className="text-xs text-muted-foreground">
                      {photoFile ? `Preview of ${photoFile.name}. Upload to save it.` : "JPG or PNG work best. Square images look best."}
                    </p>
                  </div>
                </div>
                {uploadPhotoM.error ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{getErrorMessage(uploadPhotoM.error)}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t">
                {photoFile ? (
                  <Button variant="ghost" onClick={() => setPhotoFile(null)} disabled={uploadPhotoM.isPending}>
                    Cancel
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => uploadPhotoM.mutate()} disabled={!photoFile || uploadPhotoM.isPending}>
                  {uploadPhotoM.isPending ? <Spinner /> : <Upload />}
                  {uploadPhotoM.isPending ? "Uploading..." : "Upload picture"}
                </Button>
              </CardFooter>
            </Card>

            {/* Personal + contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" />
                  Personal & contact info
                </CardTitle>
                <CardDescription>Used to autofill your name, phone and address at checkout.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      aria-invalid={name.length > 0 && name.trim().length < 2}
                    />
                    {name.trim().length < 2 ? <p className="text-xs text-destructive">Name must be at least 2 characters.</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" value={meQ.data?.email ?? ""} readOnly disabled />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional phone number" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-address">Address</Label>
                    <Input id="profile-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Optional saved address" />
                  </div>
                </div>
                {saveProfileM.error ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{getErrorMessage(saveProfileM.error)}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
              <CardFooter className="justify-end border-t">{saveButton("Save profile")}</CardFooter>
            </Card>
          </div>

          {/* Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                Password & security
              </CardTitle>
              <CardDescription>Leave these fields empty if you only want to update your contact details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-current-password">Current password</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-new-password">New password</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-confirm-password">Confirm new password</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-invalid={passwordMismatch}
                  />
                </div>
              </div>
              {passwordMismatch ? <p className="text-xs text-destructive">The new passwords do not match.</p> : null}
              <p className="text-xs text-muted-foreground">
                Saving here also saves your personal and contact info.
              </p>
            </CardContent>
            <CardFooter className="justify-end border-t">
              {passwordTouched ? saveButton("Update password") : saveButton("Save changes")}
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
