import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { Alert, AppText, Avatar, Badge, Button, Card, Input, Row, useColors } from "@/src/components/ui";
import { getErrorMessage } from "@/src/lib/errors";
import { api } from "@/src/lib/api";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import type { RootStackParamList } from "@/src/types/navigation";

type ProfileProps = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: ProfileProps) {
  const access = useProtectedAccess("Profile");
  const c = useColors();
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

  const me = access.me;
  const nameInvalid = name.trim().length < 2;
  const passwordTouched = Boolean(currentPassword || newPassword || confirmPassword);
  const passwordMismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);
  const canSave = !saveProfileM.isPending && !nameInvalid;
  const saveError = saveProfileM.error ? getErrorMessage(saveProfileM.error) : null;

  const save = () => {
    setSuccessMessage(null);
    saveProfileM.mutate();
  };

  const saveButton = (label: string) => (
    <Row justify="flex-end">
      <Button onPress={save} disabled={!canSave} loading={saveProfileM.isPending} icon={saveProfileM.isPending ? undefined : "checkmark"}>
        {saveProfileM.isPending ? "Saving..." : label}
      </Button>
    </Row>
  );

  return (
    <AppShell navigation={navigation} screenName="Profile" title="Profile settings" subtitle="Saved details are filled in automatically at checkout.">
      {successMessage ? <Alert tone="success" title={successMessage} /> : null}

      <Card title="Profile picture" description="Shown to markets and drivers on your orders.">
        <Row gap={16}>
          <Avatar name={me?.name} uri={me?.profile_photo_url} size={72} />
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>{me?.name || "Your account"}</AppText>
            <AppText variant="small" tone="muted" numberOfLines={1}>{me?.email}</AppText>
            {me?.roles?.length ? (
              <Row gap={6} wrap style={styles.roles}>
                {me.roles.map((role: string) => (
                  <Badge key={role} tone="neutral">{role}</Badge>
                ))}
              </Row>
            ) : null}
          </View>
        </Row>
      </Card>

      <Card
        title="Personal & contact info"
        description="Used to autofill your name, phone and address at checkout."
        right={<Ionicons name="person-outline" size={18} color={c.mutedForeground} />}
        footer={saveButton("Save profile")}
      >
        <View style={styles.gap16}>
          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            error={nameInvalid ? "Name must be at least 2 characters." : null}
          />
          <Input label="Email" value={me?.email || ""} onChangeText={() => {}} editable={false} placeholder="Email" helper="Email cannot be changed here." />
          <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional phone number" keyboardType="phone-pad" icon="call-outline" />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Optional saved address" multiline icon="location-outline" />
          {saveError ? <Alert tone="destructive" title="Could not save profile" description={saveError} /> : null}
        </View>
      </Card>

      <Card
        title="Password & security"
        description="Leave these fields empty if you only want to update your contact details."
        right={<Ionicons name="key-outline" size={18} color={c.mutedForeground} />}
        footer={saveButton(passwordTouched ? "Update password" : "Save changes")}
      >
        <View style={styles.gap16}>
          <Input label="Current password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry autoCapitalize="none" />
          <Input label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry autoCapitalize="none" />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            autoCapitalize="none"
            error={passwordMismatch ? "The new passwords do not match." : null}
          />
          <AppText variant="caption">Saving here also saves your personal and contact info.</AppText>
        </View>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap16: { gap: 16 },
  roles: { marginTop: 8 },
});
