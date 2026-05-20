import { Suspense } from "react";
import { AuthScreen } from "../app/components/AuthScreen";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthScreen mode="login" />
    </Suspense>
  );
}
