import { Suspense } from "react";
import { AuthScreen } from "../app/components/AuthScreen";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthScreen mode="forgot" />
    </Suspense>
  );
}
