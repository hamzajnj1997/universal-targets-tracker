import { Suspense } from "react";
import { AuthScreen } from "../app/components/AuthScreen";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthScreen mode="signup" />
    </Suspense>
  );
}
