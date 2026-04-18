import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { AppButton, HelperText, InputField, SectionCard } from "@/src/components/ui";
import { getErrorMessage } from "@/src/lib/errors";
import { api } from "@/src/lib/api";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import type { RootStackParamList } from "@/src/types/navigation";

type ProfileProps = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: ProfileProps) {
  const access = useProtectedAccess("Profile");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!access.me) {
      return;
    }

    setName(access.me.name ?? "");
    setPhone(access.me.phone ?? "");
    setAddress(access.me.address ?? "");
  }, [access.me]);

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

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="Profile" title="Profile settings" subtitle="Manage saved customer details and password in one place.">
      <SectionCard title="Profile details" subtitle="These fields are reused during checkout when available.">
        <InputField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <InputField label="Email" value={access.me?.email || ""} onChangeText={() => {}} editable={false} placeholder="Email" />
        <InputField label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional phone number" />
        <InputField label="Address" value={address} onChangeText={setAddress} placeholder="Optional saved address" multiline />
      </SectionCard>

      <SectionCard title="Password" subtitle="Leave blank if you only want to update contact details.">
        <InputField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry />
        <InputField label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
        <InputField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" secureTextEntry />
      </SectionCard>

      {saveProfileM.error ? <HelperText tone="danger">{getErrorMessage(saveProfileM.error)}</HelperText> : null}
      {successMessage ? <HelperText tone="success">{successMessage}</HelperText> : null}

      <AppButton onPress={() => saveProfileM.mutate()} disabled={saveProfileM.isPending || name.trim().length < 2}>
        {saveProfileM.isPending ? "Saving..." : "Save profile"}
      </AppButton>
    </AppShell>
  );
}
